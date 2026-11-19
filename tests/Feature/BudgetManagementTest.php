<?php

use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\BudgetProgressService;

function phase5Workspace(string $role = 'owner'): array
{
    $owner = User::factory()->create();
    $user = $role === 'owner' ? $owner : User::factory()->create();
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    if ($role !== 'owner') {
        WorkspaceMember::factory()->for($workspace)->for($user)->create(['role' => $role]);
    }

    return [$user, $workspace];
}

/** @return array<string, mixed> */
function phase5BudgetPayload(Workspace $workspace, array $overrides = []): array
{
    return [
        'name' => 'November plan',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'total_amount' => '1000000',
        'allocations' => [],
        ...$overrides,
    ];
}

function phase5Expense(Workspace $workspace, Category $category, int $amount, string $date): Transaction
{
    $account = Account::factory()->for($workspace)->create(['type' => 'cash', 'initial_balance' => 0]);

    return Transaction::factory()->for($workspace)->expense()->create([
        'category_id' => $category->id,
        'account_id' => $account->id,
        'amount' => $amount,
        'transaction_date' => $date,
        'created_by' => $workspace->owner_id,
    ]);
}

it('creates a monthly budget with category allocations', function () {
    [$user, $workspace] = phase5Workspace();
    $food = Category::factory()->for($workspace)->expense()->create();
    $transport = Category::factory()->for($workspace)->expense()->create();

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->post('/budgets', phase5BudgetPayload($workspace, [
            'allocations' => [
                ['category_id' => $food->id, 'amount' => '400000'],
                ['category_id' => $transport->id, 'amount' => '150000'],
            ],
        ]))->assertRedirect()->assertSessionHasNoErrors();

    $budget = Budget::query()->where('workspace_id', $workspace->id)->firstOrFail();
    expect($budget->name)->toBe('November plan')
        ->and($budget->status)->toBe('active')
        ->and($budget->total_amount)->toBe(1000000)
        ->and($budget->period_start->format('Y-m-d'))->toBe('2026-11-01')
        ->and($budget->period_end->format('Y-m-d'))->toBe('2026-11-30')
        ->and($budget->budgetCategories()->count())->toBe(2);
});

it('allows only one active budget per workspace and calendar month', function () {
    [$user, $workspace] = phase5Workspace();
    Budget::factory()->for($workspace)->create(['created_by' => $user->id]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->post('/budgets', phase5BudgetPayload($workspace, ['name' => 'Duplicate']))
        ->assertSessionHasErrors('period_start');

    $budget = Budget::query()->where('workspace_id', $workspace->id)->firstOrFail();
    $budget->update(['status' => 'archived']);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->post('/budgets', phase5BudgetPayload($workspace, ['name' => 'Replacement']))
        ->assertRedirect()->assertSessionHasNoErrors();

    expect(Budget::query()->where('workspace_id', $workspace->id)->where('status', 'active')->count())->toBe(1);
});

it('rejects partial months, invalid amounts, duplicate allocations, and totals above the budget', function () {
    [$user, $workspace] = phase5Workspace();
    $food = Category::factory()->for($workspace)->expense()->create();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
        'period_start' => '2026-11-02',
        'period_end' => '2026-11-30',
    ]))->assertSessionHasErrors('period_start');

    $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-15',
    ]))->assertSessionHasErrors('period_end');

    $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
        'total_amount' => '0',
    ]))->assertSessionHasErrors('total_amount');

    $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
        'allocations' => [
            ['category_id' => $food->id, 'amount' => '100'],
            ['category_id' => $food->id, 'amount' => '200'],
        ],
    ]))->assertSessionHasErrors('allocations.0.category_id');

    $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
        'allocations' => [['category_id' => $food->id, 'amount' => '1000001']],
    ]))->assertSessionHasErrors('allocations');
});

it('rejects new archived, cross-workspace, and income allocations but preserves archived existing references', function () {
    [$user, $workspace] = phase5Workspace();
    [, $foreignWorkspace] = phase5Workspace();
    $food = Category::factory()->for($workspace)->expense()->create();
    $income = Category::factory()->for($workspace)->income()->create();
    $foreign = Category::factory()->for($foreignWorkspace)->expense()->create();
    $archived = Category::factory()->for($workspace)->expense()->create(['is_active' => false]);
    $session = ['active_workspace_id' => $workspace->id];

    foreach ([$income, $foreign, $archived] as $invalid) {
        $this->actingAs($user)->withSession($session)->post('/budgets', phase5BudgetPayload($workspace, [
            'allocations' => [['category_id' => $invalid->id, 'amount' => '10000']],
        ]))->assertSessionHasErrors('allocations');
    }

    $budget = Budget::factory()->for($workspace)->create(['created_by' => $user->id]);
    $budget->budgetCategories()->create(['category_id' => $food->id, 'allocated_amount' => 10000]);
    $food->update(['is_active' => false]);

    $this->actingAs($user)->withSession($session)->put("/budgets/{$budget->id}", phase5BudgetPayload($workspace, [
        'name' => 'Updated',
        'allocations' => [['category_id' => $food->id, 'amount' => '20000']],
    ]))->assertRedirect()->assertSessionHasNoErrors();

    expect($budget->fresh()->budgetCategories()->where('category_id', $food->id)->value('allocated_amount'))->toBe(20000);
});

it('calculates actual spending from non-deleted expenses by transaction date only', function () {
    [$user, $workspace] = phase5Workspace();
    $food = Category::factory()->for($workspace)->expense()->create();
    $other = Category::factory()->for($workspace)->expense()->create();
    $budget = Budget::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'total_amount' => 1000000,
    ]);
    $budget->budgetCategories()->create(['category_id' => $food->id, 'allocated_amount' => 500000]);

    phase5Expense($workspace, $food, 300000, '2026-11-01');
    phase5Expense($workspace, $food, 200000, '2026-11-30');
    phase5Expense($workspace, $food, 999000, '2026-10-31');
    phase5Expense($workspace, $food, 999000, '2026-12-01');
    phase5Expense($workspace, $other, 100000, '2026-11-15');

    $deleted = phase5Expense($workspace, $food, 999000, '2026-11-15');
    $deleted->delete();

    $account = Account::factory()->for($workspace)->create(['type' => 'cash']);
    Transaction::factory()->for($workspace)->expense()->create([
        'category_id' => $food->id,
        'account_id' => $account->id,
        'amount' => 999000,
        'transaction_date' => '2026-11-15',
        'created_by' => $user->id,
        'deleted_at' => now(),
    ]);
    Transaction::factory()->for($workspace)->income()->create([
        'category_id' => $food->id,
        'account_id' => $account->id,
        'amount' => 999000,
        'transaction_date' => '2026-11-15',
        'created_by' => $user->id,
    ]);
    Transaction::factory()->for($workspace)->transfer()->create([
        'amount' => 999000,
        'transaction_date' => '2026-11-15',
        'source_account_id' => $account->id,
        'destination_account_id' => Account::factory()->for($workspace)->create(['type' => 'cash'])->id,
        'created_by' => $user->id,
    ]);

    $progress = app(BudgetProgressService::class)->calculate($budget->load('budgetCategories.category'));

    expect($progress['actual_amount'])->toBe('600000')
        ->and($progress['remaining_amount'])->toBe('400000')
        ->and($progress['allocations'])->toHaveCount(1)
        ->and($progress['allocations'][0]['actual_amount'])->toBe('500000')
        ->and($progress['allocations'][0]['remaining_amount'])->toBe('0');
});

it('reports 70, 90, and 100 percent warning thresholds', function (string $amount, string $warning) {
    [$user, $workspace] = phase5Workspace();
    $category = Category::factory()->for($workspace)->expense()->create();
    $budget = Budget::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'total_amount' => 100000,
    ]);
    $budget->budgetCategories()->create(['category_id' => $category->id, 'allocated_amount' => 100000]);

    if ($amount !== '0') {
        phase5Expense($workspace, $category, (int) $amount, '2026-11-10');
    }

    $progress = app(BudgetProgressService::class)->calculate($budget->load('budgetCategories.category'));

    expect($progress['warning'])->toBe($warning)
        ->and($progress['allocations'][0]['warning'])->toBe($warning);
})->with([
    ['0', 'on_track'],
    ['69999', 'on_track'],
    ['70000', 'warning'],
    ['89999', 'warning'],
    ['90000', 'critical'],
    ['99999', 'critical'],
    ['100000', 'exceeded'],
]);

it('exposes active and archived budget history for all members with role-aware actions', function (string $role) {
    [$user, $workspace] = phase5Workspace($role);
    $active = Budget::factory()->for($workspace)->create([
        'created_by' => $role === 'member' ? $user->id : $workspace->owner_id,
    ]);
    Budget::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'status' => 'archived',
        'period_start' => '2026-10-01',
        'period_end' => '2026-10-31',
        'name' => 'October plan',
    ]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->get('/budgets')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('budgets/index')
            ->has('budgets', 2)
            ->where('budgets.0.id', $active->id)
            ->where('budgets.1.status', 'archived')
            ->where('canManage', in_array($role, ['owner', 'admin', 'member'], true)));
})->with(['owner', 'admin', 'member', 'viewer']);

it('lets owners and admins archive any budget and members archive only their own', function () {
    [$member, $workspace] = phase5Workspace('member');
    $own = Budget::factory()->for($workspace)->create([
        'created_by' => $member->id,
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
    ]);
    $other = Budget::factory()->for($workspace)->create([
        'created_by' => $workspace->owner_id,
        'period_start' => '2026-10-01',
        'period_end' => '2026-10-31',
    ]);

    $this->actingAs($member)->withSession(['active_workspace_id' => $workspace->id])
        ->post("/budgets/{$own->id}/archive")->assertRedirect();
    $this->actingAs($member)->withSession(['active_workspace_id' => $workspace->id])
        ->post("/budgets/{$other->id}/archive")->assertForbidden();
    expect($own->fresh()->status)->toBe('archived')
        ->and($other->fresh()->status)->toBe('active');

    foreach (['admin', 'owner'] as $role) {
        [$user, $workspace] = phase5Workspace($role);
        $budget = Budget::factory()->for($workspace)->create(['created_by' => $workspace->owner_id]);
        $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
            ->post("/budgets/{$budget->id}/archive")->assertRedirect();
        expect($budget->fresh()->status)->toBe('archived');
    }
});

it('denies viewers mutations while allowing them to view budgets', function () {
    [$viewer, $workspace] = phase5Workspace('viewer');
    $budget = Budget::factory()->for($workspace)->create(['created_by' => $workspace->owner_id]);
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($viewer)->withSession($session)->get('/budgets')->assertOk();
    $this->actingAs($viewer)->withSession($session)
        ->post('/budgets', phase5BudgetPayload($workspace))->assertForbidden();
    $this->actingAs($viewer)->withSession($session)
        ->put("/budgets/{$budget->id}", phase5BudgetPayload($workspace))->assertForbidden();
    $this->actingAs($viewer)->withSession($session)
        ->post("/budgets/{$budget->id}/archive")->assertForbidden();
});

it('allows members to edit any budget and isolates foreign workspaces', function () {
    [$member, $workspace] = phase5Workspace('member');
    $budget = Budget::factory()->for($workspace)->create([
        'created_by' => $workspace->owner_id,
        'total_amount' => 100000,
    ]);
    $foreign = Budget::factory()->create();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($member)->withSession($session)->put("/budgets/{$budget->id}", phase5BudgetPayload($workspace, [
        'name' => 'Team November',
        'total_amount' => '200000',
    ]))->assertRedirect()->assertSessionHasNoErrors();

    expect($budget->fresh()->name)->toBe('Team November')
        ->and($budget->fresh()->total_amount)->toBe(200000);

    $this->actingAs($member)->withSession($session)
        ->put("/budgets/{$foreign->id}", phase5BudgetPayload($workspace))->assertNotFound();
    $this->actingAs($member)->withSession($session)
        ->post("/budgets/{$foreign->id}/archive")->assertNotFound();
});
