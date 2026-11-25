<?php

declare(strict_types=1);

use App\Actions\ManageGoalContribution;
use App\Models\FinancialInsight;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

putenv('APP_ENV=testing');
putenv('DB_CONNECTION=pgsql');
putenv('DB_DATABASE=montra_testing');
$_ENV['APP_ENV'] = 'testing';
$_ENV['DB_CONNECTION'] = 'pgsql';
$_ENV['DB_DATABASE'] = 'montra_testing';
$_SERVER['APP_ENV'] = 'testing';
$_SERVER['DB_CONNECTION'] = 'pgsql';
$_SERVER['DB_DATABASE'] = 'montra_testing';

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$currentDb = (string) (DB::selectOne('SELECT current_database() AS db')?->db ?? '');
if ($currentDb !== 'montra_testing' || config('database.default') !== 'pgsql') {
    fwrite(STDERR, "Refusing worker execution on database [{$currentDb}].\n");
    exit(1);
}

$pid = (int) (DB::selectOne('SELECT pg_backend_pid() AS pid')?->pid ?? 0);
$mode = $argv[1] ?? '';

if ($mode === 'contribution') {
    $user = User::query()->findOrFail((int) ($argv[2] ?? 0));
    $goal = SavingsGoal::query()->findOrFail((int) ($argv[3] ?? 0));
    $amount = (int) ($argv[4] ?? 0);
    $date = (string) ($argv[5] ?? '2026-11-20');

    $contribution = app(ManageGoalContribution::class)->create($user, $goal, [
        'amount' => $amount,
        'contribution_date' => $date,
        'notes' => 'Concurrent child worker',
    ]);

    echo json_encode([
        'pid' => $pid,
        'contribution_id' => $contribution->id,
        'goal_status' => $goal->fresh()->status,
    ], JSON_THROW_ON_ERROR);

    exit(0);
}

if ($mode === 'evaluate') {
    $workspace = Workspace::query()->findOrFail((int) ($argv[2] ?? 0));
    $startDate = Carbon::parse((string) ($argv[3] ?? '2026-11-01'))->startOfDay();
    $endDate = Carbon::parse((string) ($argv[4] ?? '2026-11-30'))->endOfDay();

    $insights = app(InsightEngine::class)->evaluateWorkspace($workspace, $startDate, $endDate);

    echo json_encode([
        'pid' => $pid,
        'count' => $insights->count(),
        'database_count' => FinancialInsight::query()->where('workspace_id', $workspace->id)->count(),
    ], JSON_THROW_ON_ERROR);

    exit(0);
}

fwrite(STDERR, "Unknown worker mode [{$mode}].\n");
exit(1);
