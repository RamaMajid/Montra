<?php

use App\Actions\ManageGoalContribution;
use App\Models\Account;
use App\Models\Category;
use App\Models\FinancialInsight;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\Intelligence\Contracts\InsightRule;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

function spawnConcurrencyWorker(array $args): Process
{
    $process = new Process(
        [PHP_BINARY, base_path('tests/Concurrency/worker.php'), ...array_map('strval', $args)],
        base_path(),
        [
            'APP_ENV' => 'testing',
            'DB_CONNECTION' => 'pgsql',
            'DB_DATABASE' => 'montra_testing',
            'DB_HOST' => (string) config('database.connections.pgsql.host'),
            'DB_PORT' => (string) config('database.connections.pgsql.port'),
            'DB_USERNAME' => (string) config('database.connections.pgsql.username'),
            'DB_PASSWORD' => (string) config('database.connections.pgsql.password'),
        ],
        null,
        20
    );
    $process->start();

    return $process;
}

function waitForWorkerToBlock(int $parentPid, int $timeoutMs = 15000): bool
{
    $deadline = microtime(true) + ($timeoutMs / 1000);
    while (microtime(true) < $deadline) {
        DB::purge('concurrency_observer');
        config(['database.connections.concurrency_observer' => config('database.connections.pgsql')]);
        $observer = DB::connection('concurrency_observer');
        $waiting = (int) ($observer->selectOne(
            "SELECT COUNT(*) AS c FROM pg_stat_activity WHERE datname = 'montra_testing' AND ? = ANY(pg_blocking_pids(pid))",
            [$parentPid]
        )?->c ?? 0);

        if ($waiting > 0) {
            return true;
        }

        usleep(25000);
    }

    return false;
}

it('serializes concurrent PostgreSQL goal contributions with FOR UPDATE and keeps total and status consistent', function () {
    $user = null;
    $workspace = null;

    try {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $workspace = Workspace::factory()->family()->for($user, 'owner')->create();
        WorkspaceMember::factory()->owner()->for($workspace)->for($user)->create();
        $goal = SavingsGoal::factory()->for($workspace)->create([
            'target_amount' => 1000000,
            'status' => 'active',
            'created_by' => $user->id,
        ]);

        $parentPid = (int) (DB::selectOne('SELECT pg_backend_pid() AS pid')?->pid ?? 0);
        $child = null;

        DB::beginTransaction();
        try {
            SavingsGoal::query()->whereKey($goal->id)->lockForUpdate()->firstOrFail();

            $child = spawnConcurrencyWorker(['contribution', $user->id, $goal->id, 400000, '2026-11-20']);
            expect(waitForWorkerToBlock($parentPid))->toBeTrue($child->getErrorOutput().' '.$child->getOutput());

            app(ManageGoalContribution::class)->create($user, $goal, [
                'amount' => 600000,
                'contribution_date' => '2026-11-20',
                'notes' => 'Parent lock holder',
            ]);

            DB::commit();
        } catch (Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $child->wait();
        expect($child->isSuccessful())->toBeTrue($child->getErrorOutput());
        $payload = json_decode($child->getOutput(), true, 512, JSON_THROW_ON_ERROR);

        expect($payload['pid'])->not->toBe($parentPid)
            ->and(GoalContribution::query()->where('savings_goal_id', $goal->id)->count())->toBe(2)
            ->and((int) GoalContribution::query()->where('savings_goal_id', $goal->id)->sum('amount'))->toBe(1000000)
            ->and($goal->fresh()->status)->toBe('completed');
    } finally {
        if ($workspace) {
            $workspace->forceDelete();
        }
        if ($user) {
            $user->forceDelete();
        }
    }
});

it('keeps goal status synchronized when a locked concurrent contribution rolls back', function () {
    $user = null;
    $workspace = null;

    try {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $workspace = Workspace::factory()->family()->for($user, 'owner')->create();
        WorkspaceMember::factory()->owner()->for($workspace)->for($user)->create();
        $goal = SavingsGoal::factory()->for($workspace)->create([
            'target_amount' => 1000000,
            'status' => 'active',
            'created_by' => $user->id,
        ]);

        $parentPid = (int) (DB::selectOne('SELECT pg_backend_pid() AS pid')?->pid ?? 0);

        DB::beginTransaction();
        SavingsGoal::query()->whereKey($goal->id)->lockForUpdate()->firstOrFail();

        $child = spawnConcurrencyWorker(['contribution', $user->id, $goal->id, 600000, '2026-11-20']);
        expect(waitForWorkerToBlock($parentPid))->toBeTrue($child->getErrorOutput().' '.$child->getOutput());

        app(ManageGoalContribution::class)->create($user, $goal, [
            'amount' => 1000000,
            'contribution_date' => '2026-11-20',
            'notes' => 'Rolled back full payment',
        ]);
        DB::rollBack();

        $child->wait();
        expect($child->isSuccessful())->toBeTrue($child->getErrorOutput());

        expect(GoalContribution::query()->where('savings_goal_id', $goal->id)->count())->toBe(1)
            ->and((int) GoalContribution::query()->where('savings_goal_id', $goal->id)->sum('amount'))->toBe(600000)
            ->and($goal->fresh()->status)->toBe('active');
    } finally {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        if ($workspace) {
            $workspace->forceDelete();
        }
        if ($user) {
            $user->forceDelete();
        }
    }
});

it('handles concurrent PostgreSQL insight evaluation on the same fingerprint without duplicate or exception and preserves read state', function () {
    $user = null;
    $workspace = null;

    try {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $workspace = Workspace::factory()->family()->for($user, 'owner')->create();
        WorkspaceMember::factory()->owner()->for($workspace)->for($user)->create();
        $account = Account::factory()->for($workspace)->create(['initial_balance' => 10000000]);
        $category = Category::factory()->for($workspace)->income()->create();

        Transaction::factory()->for($workspace)->create([
            'type' => 'income',
            'amount' => 2000000,
            'transaction_date' => '2026-10-10',
            'account_id' => $account->id,
            'category_id' => $category->id,
            'source_account_id' => null,
            'destination_account_id' => null,
            'created_by' => $user->id,
        ]);

        $startDate = Carbon::parse('2026-11-01')->startOfDay();
        $endDate = Carbon::parse('2026-11-30')->endOfDay();
        $fingerprint = hash('sha256', "{$workspace->id}:income_zero:2026-11-01:2026-11-30");

        $existing = FinancialInsight::factory()->for($workspace)->create([
            'rule_key' => 'income_zero',
            'title' => 'Stale title',
            'description' => 'Stale description',
            'severity' => 'info',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'supporting_data' => ['previous_income' => '1'],
            'is_read' => true,
            'fingerprint' => $fingerprint,
        ]);

        $parentPid = (int) (DB::selectOne('SELECT pg_backend_pid() AS pid')?->pid ?? 0);

        DB::beginTransaction();
        FinancialInsight::query()->whereKey($existing->id)->lockForUpdate()->firstOrFail();

        $child1 = spawnConcurrencyWorker(['evaluate', $workspace->id, '2026-11-01', '2026-11-30']);
        $child2 = spawnConcurrencyWorker(['evaluate', $workspace->id, '2026-11-01', '2026-11-30']);
        expect(waitForWorkerToBlock($parentPid))->toBeTrue($child1->getErrorOutput().' '.$child1->getOutput().' '.$child2->getErrorOutput().' '.$child2->getOutput());

        app(InsightEngine::class)->evaluateWorkspace($workspace, $startDate, $endDate);
        DB::commit();

        $child1->wait();
        $child2->wait();
        expect($child1->isSuccessful())->toBeTrue($child1->getErrorOutput())
            ->and($child2->isSuccessful())->toBeTrue($child2->getErrorOutput());

        $p1 = json_decode($child1->getOutput(), true, 512, JSON_THROW_ON_ERROR);
        $p2 = json_decode($child2->getOutput(), true, 512, JSON_THROW_ON_ERROR);

        expect($p1['pid'])->not->toBe($parentPid)
            ->and($p2['pid'])->not->toBe($parentPid)
            ->and($p1['pid'])->not->toBe($p2['pid'])
            ->and(FinancialInsight::query()->where('workspace_id', $workspace->id)->count())->toBe(1);

        $refreshed = $existing->fresh();
        expect($refreshed->title)->toBe('Tidak Ada Pemasukan Tercatat')
            ->and($refreshed->severity)->toBe('warning')
            ->and($refreshed->supporting_data['previous_income'])->toBe('2000000')
            ->and($refreshed->is_read)->toBeTrue();
    } finally {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        if ($workspace) {
            $workspace->forceDelete();
        }
        if ($user) {
            $user->forceDelete();
        }
    }
});

it('keeps database unique constraint as last line of defense and propagates non-duplicate PostgreSQL errors', function () {
    $user = null;
    $workspace = null;

    try {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $workspace = Workspace::factory()->family()->for($user, 'owner')->create();
        FinancialInsight::factory()->for($workspace)->create(['fingerprint' => 'unique-fp']);

        expect(fn () => DB::table('financial_insights')->insert([
            'workspace_id' => $workspace->id,
            'rule_key' => 'income_zero',
            'title' => 'Duplicate raw insert',
            'description' => 'Should fail raw insert',
            'severity' => 'warning',
            'supporting_data' => '{}',
            'is_read' => false,
            'fingerprint' => 'unique-fp',
            'generated_at' => now()->toDateTimeString(),
            'created_at' => now()->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ]))->toThrow(QueryException::class);

        $invalidRule = new class implements InsightRule
        {
            public function key(): string
            {
                return 'invalid';
            }

            public function name(): string
            {
                return 'Invalid';
            }

            public function category(): string
            {
                return 'invalid';
            }

            public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
            {
                return [[
                    'rule_key' => 'invalid',
                    'title' => 'Invalid severity',
                    'description' => 'Triggers PostgreSQL check constraint',
                    'severity' => 'not_a_valid_severity',
                    'period_start' => null,
                    'period_end' => null,
                    'supporting_data' => [],
                    'fingerprint' => 'bad-severity-fp',
                ]];
            }
        };

        $engine = app(InsightEngine::class)->registerRule($invalidRule);
        expect(fn () => $engine->evaluateWorkspace($workspace))->toThrow(QueryException::class);
    } finally {
        if ($workspace) {
            $workspace->forceDelete();
        }
        if ($user) {
            $user->forceDelete();
        }
    }
});
