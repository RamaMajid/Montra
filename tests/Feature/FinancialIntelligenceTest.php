<?php

use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\FinancialInsight;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\Intelligence\InsightEngine;
use Illuminate\Support\Carbon;

function intelligenceWorkspace(string $role = 'owner'): array
{
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $user = $role === 'owner' ? $owner : User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    if ($role !== 'owner') {
        WorkspaceMember::factory()->for($workspace)->for($user)->create(['role' => $role]);
    }

    return [$user, $workspace];
}

function intelTransaction(Workspace $workspace, string $type, int $amount, string $date, ?Category $category = null): Transaction
{
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 10000000]);

    return Transaction::factory()->for($workspace)->create([
        'type' => $type,
        'amount' => $amount,
        'transaction_date' => $date,
        'account_id' => $account->id,
        'category_id' => $category?->id,
        'source_account_id' => null,
        'destination_account_id' => null,
        'created_by' => $workspace->owner_id,
    ]);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-20 12:00:00');
});

afterEach(function () {
    Carbon::setTestNow();
});

it('evaluates budget warning, critical, and exceeded thresholds', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();

    $budget = Budget::factory()->for($workspace)->create([
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'total_amount' => 1000000,
        'created_by' => $user->id,
    ]);
    $budget->budgetCategories()->create(['category_id' => $cat->id, 'allocated_amount' => 1000000]);

    // 75% expense (750.000) -> warning
    intelTransaction($workspace, 'expense', 750000, '2026-11-10', $cat);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=budget_warning');

    $response->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.severity', 'warning')
        ->assertJsonPath('insights.0.supporting_data.utilization', '75');
});

it('evaluates spending pattern increases and decreases', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $food = Category::factory()->for($workspace)->expense()->create(['name' => 'Food']);

    // October (previous month): 500.000
    intelTransaction($workspace, 'expense', 500000, '2026-10-15', $food);

    // November (current month): 800.000 (60% increase)
    intelTransaction($workspace, 'expense', 800000, '2026-11-10', $food);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=spending_increase');

    $response->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.title', 'Peningkatan Pengeluaran: Food')
        ->assertJsonPath('insights.0.supporting_data.change_percentage', '60');
});

it('does not evaluate spending changes below minimum threshold', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $misc = Category::factory()->for($workspace)->expense()->create(['name' => 'Misc']);

    // Under minimum threshold of 250.000
    intelTransaction($workspace, 'expense', 10000, '2026-10-15', $misc);
    intelTransaction($workspace, 'expense', 30000, '2026-11-10', $misc);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence');

    $response->assertOk()
        ->assertJsonCount(0, 'insights');
});

it('evaluates income changes and zero income warnings', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $incomeCat = Category::factory()->for($workspace)->income()->create();

    // October: 5.000.000
    intelTransaction($workspace, 'income', 5000000, '2026-10-10', $incomeCat);

    // November: 0 income -> triggers income_zero
    $resZero = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=income_zero');

    $resZero->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.severity', 'warning')
        ->assertJsonPath('insights.0.title', 'Tidak Ada Pemasukan Tercatat');

    // Add November income of 3.000.000 (40% decrease from 5.000.000)
    intelTransaction($workspace, 'income', 3000000, '2026-11-15', $incomeCat);

    $resDec = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=income_decrease');

    $resDec->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.title', 'Penurunan Pemasukan')
        ->assertJsonPath('insights.0.supporting_data.change_percentage', '-40');
});

it('evaluates savings progress milestones', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Laptop Baru',
        'target_amount' => 10000000,
        'created_by' => $user->id,
    ]);

    // 50% milestone
    GoalContribution::factory()->for($goal)->create(['amount' => 5000000, 'created_by' => $user->id]);

    $res50 = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=savings_milestone_50');

    $res50->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.title', 'Target Tabungan Mencapai 50%: Laptop Baru');

    // Add 3.000.000 reaching 80%
    GoalContribution::factory()->for($goal)->create(['amount' => 3000000, 'created_by' => $user->id]);

    $res80 = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=savings_milestone_80');

    $res80->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.title', 'Target Tabungan Mendekati Selesai: Laptop Baru');

    // Add 2.000.000 reaching 100% completed
    GoalContribution::factory()->for($goal)->create(['amount' => 2000000, 'created_by' => $user->id]);

    $res100 = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=savings_goal_completed');

    $res100->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.title', 'Target Tabungan Tercapai: Laptop Baru');
});

it('evaluates unusual transactions and requires minimum baseline', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();

    // Baseline: only 2 transactions (< 3 required baseline) -> should not trigger
    intelTransaction($workspace, 'expense', 100000, '2026-11-05', $cat);
    intelTransaction($workspace, 'expense', 100000, '2026-11-06', $cat);
    intelTransaction($workspace, 'expense', 2000000, '2026-11-10', $cat);

    $resNoBase = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=unusual_expense');
    $resNoBase->assertOk()->assertJsonCount(0, 'insights');

    // Add 3rd historical baseline expense of 100.000
    // Total expenses: 100k, 100k, 100k, 2M. Count = 4 (>= 3).
    // Average expense = 575.000, threshold = max(500k, 575k * 3 = 1.725.000).
    // 2.000.000 >= 1.725.000 -> triggers unusual_expense!
    intelTransaction($workspace, 'expense', 100000, '2026-11-07', $cat);

    $resTrigger = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/intelligence?rule_key=unusual_expense');

    $resTrigger->assertOk()
        ->assertJsonCount(1, 'insights')
        ->assertJsonPath('insights.0.rule_key', 'unusual_expense')
        ->assertJsonPath('insights.0.severity', 'warning');
});

it('prevents duplicate insights across multiple evaluations', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $cat = Category::factory()->for($workspace)->income()->create();
    intelTransaction($workspace, 'income', 1000000, '2026-10-10', $cat);

    $engine = app(InsightEngine::class);

    // Run evaluation 3 times
    $engine->evaluateWorkspace($workspace);
    $engine->evaluateWorkspace($workspace);
    $engine->evaluateWorkspace($workspace);

    $count = FinancialInsight::where('workspace_id', $workspace->id)->count();
    expect($count)->toBe(1);
});

it('marks single insight and all insights as read', function () {
    [$user, $workspace] = intelligenceWorkspace();

    $i1 = FinancialInsight::factory()->for($workspace)->create(['is_read' => false]);
    $i2 = FinancialInsight::factory()->for($workspace)->create(['is_read' => false]);

    // Mark single as read
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->patchJson("/intelligence/{$i1->id}/read")
        ->assertOk()
        ->assertJsonPath('message', 'Insight marked as read.');

    expect($i1->fresh()->is_read)->toBeTrue()
        ->and($i2->fresh()->is_read)->toBeFalse();

    // Mark all as read
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson('/intelligence/read-all')
        ->assertOk()
        ->assertJsonPath('message', 'All insights marked as read.')
        ->assertJsonPath('updated_count', 1);

    expect($i2->fresh()->is_read)->toBeTrue();
});

it('enforces workspace isolation on financial insights', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $otherWorkspace = Workspace::factory()->create();
    $otherInsight = FinancialInsight::factory()->for($otherWorkspace)->create();

    // Cannot read other workspace insight
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->patchJson("/intelligence/{$otherInsight->id}/read")
        ->assertNotFound();
});

it('artisan command montra:generate-insights runs successfully', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $cat = Category::factory()->for($workspace)->income()->create();
    intelTransaction($workspace, 'income', 1000000, '2026-10-10', $cat);

    $this->artisan("montra:generate-insights --workspace={$workspace->id}")
        ->assertSuccessful();

    expect(FinancialInsight::where('workspace_id', $workspace->id)->count())->toBeGreaterThan(0);
});

it('insight evaluation does not mutate financial data', function () {
    [$user, $workspace] = intelligenceWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 5000000]);
    $cat = Category::factory()->for($workspace)->income()->create();
    intelTransaction($workspace, 'income', 1000000, '2026-10-10', $cat);

    $txCountBefore = Transaction::count();
    $accountBalanceBefore = $account->fresh()->initial_balance;

    $engine = app(InsightEngine::class);
    $engine->evaluateWorkspace($workspace);

    expect(Transaction::count())->toBe($txCountBefore)
        ->and($account->fresh()->initial_balance)->toBe($accountBalanceBefore);
});
