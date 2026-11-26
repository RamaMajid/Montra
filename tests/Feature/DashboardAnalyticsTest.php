<?php

use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\FinancialAnalyticsService;
use Illuminate\Support\Carbon;

function analyticsWorkspace(): array
{
    $user = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($user, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($user)->create();

    return [$user, $workspace];
}

function analyticsTransaction(Workspace $workspace, Account $account, Category $category, string $type, int $amount, string $date): Transaction
{
    return Transaction::factory()->for($workspace)->create([
        'type' => $type,
        'amount' => $amount,
        'transaction_date' => $date,
        'account_id' => $account->id,
        'category_id' => $category->id,
        'source_account_id' => null,
        'destination_account_id' => null,
        'created_by' => $workspace->owner_id,
    ]);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-19 12:00:00');
});

afterEach(function () {
    Carbon::setTestNow();
});

it('returns empty dashboard analytics safely', function () {
    [$user, $workspace] = analyticsWorkspace();

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics');

    $response->assertOk()
        ->assertJsonPath('period.start_date', '2026-11-01')
        ->assertJsonPath('period.end_date', '2026-11-30')
        ->assertJsonPath('summary.total_balance', '0')
        ->assertJsonPath('summary.total_income', '0')
        ->assertJsonPath('summary.total_expense', '0')
        ->assertJsonPath('summary.net_cash_flow', '0')
        ->assertJsonPath('summary.savings_rate', null)
        ->assertJsonCount(30, 'trends')
        ->assertJsonCount(0, 'expense_breakdown')
        ->assertJsonCount(0, 'account_distribution')
        ->assertJsonCount(0, 'budget');
});

it('calculates summary and excludes transfers and deleted transactions', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 100000, 'is_active' => true]);
    $destination = Account::factory()->for($workspace)->create(['initial_balance' => 0, 'is_active' => true]);
    $incomeCategory = Category::factory()->for($workspace)->income()->create();
    $expenseCategory = Category::factory()->for($workspace)->expense()->create();

    analyticsTransaction($workspace, $account, $incomeCategory, 'income', 1000000, '2026-11-05');
    analyticsTransaction($workspace, $account, $expenseCategory, 'expense', 400000, '2026-11-10');
    analyticsTransaction($workspace, $account, $incomeCategory, 'income', 999000, '2026-10-31');
    $deleted = analyticsTransaction($workspace, $account, $expenseCategory, 'expense', 999000, '2026-11-12');
    $deleted->delete();
    Transaction::factory()->for($workspace)->transfer()->create([
        'amount' => 200000,
        'transaction_date' => '2026-11-15',
        'source_account_id' => $account->id,
        'destination_account_id' => $destination->id,
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics?period=current_month');

    $response->assertOk()
        ->assertJsonPath('summary.total_income', '1000000')
        ->assertJsonPath('summary.total_expense', '400000')
        ->assertJsonPath('summary.net_cash_flow', '600000')
        ->assertJsonPath('summary.savings_rate', '60')
        ->assertJsonPath('summary.transaction_counts.transfer', 1)
        ->assertJsonPath('summary.total_balance', '1699000');
});

it('fills chronological daily trend intervals and respects period boundaries', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $income = Category::factory()->for($workspace)->income()->create();
    $expense = Category::factory()->for($workspace)->expense()->create();

    analyticsTransaction($workspace, $account, $income, 'income', 100000, '2026-11-01');
    analyticsTransaction($workspace, $account, $expense, 'expense', 25000, '2026-11-03');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics?period=custom&date_from=2026-11-01&date_to=2026-11-03');

    $response->assertOk()
        ->assertJsonCount(3, 'trends')
        ->assertJsonPath('trends.0.date', '2026-11-01')
        ->assertJsonPath('trends.0.income', '100000')
        ->assertJsonPath('trends.1.income', '0')
        ->assertJsonPath('trends.1.expense', '0')
        ->assertJsonPath('trends.2.date', '2026-11-03')
        ->assertJsonPath('trends.2.expense', '25000');
});

it('groups long ranges by month and fills empty months', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $income = Category::factory()->for($workspace)->income()->create();

    analyticsTransaction($workspace, $account, $income, 'income', 100000, '2026-01-10');
    analyticsTransaction($workspace, $account, $income, 'income', 200000, '2026-03-10');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics?period=custom&date_from=2026-01-01&date_to=2026-03-31');

    $response->assertOk()
        ->assertJsonCount(3, 'trends')
        ->assertJsonPath('trends.0.date', '2026-01')
        ->assertJsonPath('trends.1.income', '0')
        ->assertJsonPath('trends.2.date', '2026-03');
});

it('returns deterministic expense category breakdown including archived categories', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $food = Category::factory()->for($workspace)->expense()->create(['name' => 'Food', 'is_active' => false]);
    $transport = Category::factory()->for($workspace)->expense()->create(['name' => 'Transport']);

    analyticsTransaction($workspace, $account, $food, 'expense', 300000, '2026-11-05');
    analyticsTransaction($workspace, $account, $transport, 'expense', 100000, '2026-11-06');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics');

    $response->assertOk()
        ->assertJsonCount(2, 'expense_breakdown')
        ->assertJsonPath('expense_breakdown.0.name', 'Food')
        ->assertJsonPath('expense_breakdown.0.amount', '300000')
        ->assertJsonPath('expense_breakdown.0.percentage', '75')
        ->assertJsonPath('expense_breakdown.1.percentage', '25');
});

it('uses derived active account balances and excludes archived accounts from summary', function () {
    [$user, $workspace] = analyticsWorkspace();
    $active = Account::factory()->for($workspace)->create(['initial_balance' => 500000, 'is_active' => true]);
    $archived = Account::factory()->for($workspace)->create(['initial_balance' => 900000, 'is_active' => false]);
    $category = Category::factory()->for($workspace)->expense()->create();
    analyticsTransaction($workspace, $active, $category, 'expense', 100000, '2026-11-10');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics');

    $response->assertOk()
        ->assertJsonPath('summary.total_balance', '400000')
        ->assertJsonCount(1, 'account_distribution')
        ->assertJsonPath('account_distribution.0.balance', '400000');

    expect($active->fresh()->initial_balance)->toBe(500000)
        ->and($archived->fresh()->initial_balance)->toBe(900000);
});

it('integrates phase five budget progress without counting transfers', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $destination = Account::factory()->for($workspace)->create();
    $category = Category::factory()->for($workspace)->expense()->create();
    $budget = Budget::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'total_amount' => 1000000,
    ]);
    $budget->budgetCategories()->create(['category_id' => $category->id, 'allocated_amount' => 500000]);

    analyticsTransaction($workspace, $account, $category, 'expense', 300000, '2026-11-10');
    Transaction::factory()->for($workspace)->transfer()->create([
        'amount' => 200000,
        'transaction_date' => '2026-11-11',
        'source_account_id' => $account->id,
        'destination_account_id' => $destination->id,
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics');

    $response->assertOk()
        ->assertJsonPath('budget.0.budget_id', $budget->id)
        ->assertJsonPath('budget.0.actual_amount', '300000')
        ->assertJsonPath('budget.0.remaining_amount', '700000')
        ->assertJsonPath('budget.0.allocations.0.actual_amount', '300000');
});

it('compares equivalent previous period safely when previous values are zero', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $income = Category::factory()->for($workspace)->income()->create();
    $expense = Category::factory()->for($workspace)->expense()->create();

    analyticsTransaction($workspace, $account, $income, 'income', 500000, '2026-10-10');
    analyticsTransaction($workspace, $account, $expense, 'expense', 200000, '2026-10-11');
    analyticsTransaction($workspace, $account, $income, 'income', 750000, '2026-11-10');
    analyticsTransaction($workspace, $account, $expense, 'expense', 100000, '2026-11-11');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics');

    $response->assertOk()
        ->assertJsonPath('summary.comparison.previous_start', '2026-10-01')
        ->assertJsonPath('summary.comparison.previous_end', '2026-10-31')
        ->assertJsonPath('summary.comparison.income_change', '250000')
        ->assertJsonPath('summary.comparison.income_change_percentage', '50')
        ->assertJsonPath('summary.comparison.expense_change', '-100000')
        ->assertJsonPath('summary.comparison.expense_change_percentage', '-50');
});

it('validates custom periods', function () {
    [$user, $workspace] = analyticsWorkspace();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)
        ->get('/analytics?period=custom')
        ->assertSessionHasErrors(['date_from', 'date_to']);

    $this->actingAs($user)->withSession($session)
        ->get('/analytics?period=custom&date_from=2026-11-30&date_to=2026-11-01')
        ->assertSessionHasErrors('date_to');

    $this->actingAs($user)->withSession($session)
        ->get('/analytics?period=invalid')
        ->assertSessionHasErrors('period');
});

it('enforces workspace isolation and switches active workspace analytics', function () {
    [$user, $workspace] = analyticsWorkspace();
    $secondWorkspace = Workspace::factory()->family()->for($user, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($secondWorkspace)->for($user)->create();

    $accountOne = Account::factory()->for($workspace)->create();
    $accountTwo = Account::factory()->for($secondWorkspace)->create();
    $categoryOne = Category::factory()->for($workspace)->income()->create();
    $categoryTwo = Category::factory()->for($secondWorkspace)->income()->create();
    analyticsTransaction($workspace, $accountOne, $categoryOne, 'income', 100000, '2026-11-10');
    analyticsTransaction($secondWorkspace, $accountTwo, $categoryTwo, 'income', 900000, '2026-11-10');

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics?workspace_id='.$secondWorkspace->id)
        ->assertOk()
        ->assertJsonPath('summary.total_income', '100000');

    $this->actingAs($user)->withSession(['active_workspace_id' => $secondWorkspace->id])
        ->get('/analytics')
        ->assertOk()
        ->assertJsonPath('summary.total_income', '900000');
});

it('does not honor a foreign workspace id in the session', function () {
    [, $workspace] = analyticsWorkspace();
    $outsider = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($outsider)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics')
        ->assertOk()
        ->assertJsonPath('summary.total_income', '0');
});

it('passes stable analytics data contract to analytics inertia response', function () {
    [$user, $workspace] = analyticsWorkspace();
    $viewer = User::factory()->create(['email_verified_at' => now()]);
    WorkspaceMember::factory()->for($workspace)->for($viewer)->create(['role' => 'viewer']);
    $outsider = User::factory()->create(['email_verified_at' => now()]);
    $secondWorkspace = Workspace::factory()->family()->for($user, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($secondWorkspace)->for($user)->create();

    $account = Account::factory()->for($workspace)->create(['initial_balance' => 100000, 'is_active' => true]);
    $secondAccount = Account::factory()->for($secondWorkspace)->create();
    $income = Category::factory()->for($workspace)->income()->create();
    $expense = Category::factory()->for($workspace)->expense()->create();
    $secondIncome = Category::factory()->for($secondWorkspace)->income()->create();

    analyticsTransaction($workspace, $account, $income, 'income', 100000, '2026-11-01');
    analyticsTransaction($workspace, $account, $expense, 'expense', 25000, '2026-11-03');
    analyticsTransaction($workspace, $account, $expense, 'expense', 40000, '2026-10-10');
    analyticsTransaction($secondWorkspace, $secondAccount, $secondIncome, 'income', 900000, '2026-11-01');

    $this->get('/analytics/page')->assertRedirect('/login');

    $json = $this->actingAs($viewer)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/analytics?period=custom&date_from=2026-11-01&date_to=2026-11-03')
        ->assertOk()
        ->json();

    $this->actingAs($viewer)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics/page?period=custom&date_from=2026-11-01&date_to=2026-11-03')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('analytics/index', false)
            ->where('filters.period', 'custom')
            ->where('filters.date_from', '2026-11-01')
            ->where('filters.date_to', '2026-11-03')
            ->where('period', $json['period'])
            ->where('summary', $json['summary'])
            ->where('trends', $json['trends'])
            ->where('category_trends', $json['category_trends'])
            ->where('savings_rate_trends', $json['savings_rate_trends'])
            ->where('expense_breakdown', $json['expense_breakdown'])
            ->where('account_distribution', $json['account_distribution'])
            ->where('budget', $json['budget'])
            ->where('recent_transactions', $json['recent_transactions'])
        );

    $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics/page?period=previous_month&workspace_id='.$secondWorkspace->id)
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('analytics/index', false)
            ->where('filters.period', 'previous_month')
            ->where('period.type', 'previous_month')
            ->where('summary.total_income', '0')
            ->where('summary.total_expense', '40000')
            ->where('summary.savings_rate', null)
        );

    $this->actingAs($outsider)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics/page?period=current_month')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('summary.total_income', '0')
            ->where('summary.savings_rate', null)
        );

    $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/analytics/page?period=invalid')
        ->assertSessionHasErrors('period');
});

it('passes stable analytics data contract to dashboard inertia response', function () {
    [$user, $workspace] = analyticsWorkspace();

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/dashboard');

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('period')
            ->has('summary')
            ->has('trends', 30)
            ->has('expense_breakdown')
            ->has('account_distribution')
            ->has('budget')
            ->has('recent_transactions')
        );
});

it('calculates rounded percentages without overflow across signed integer boundaries', function () {
    $service = app(FinancialAnalyticsService::class);
    expect($service->percentage(PHP_INT_MAX, PHP_INT_MAX))->toBe('100')
        ->and($service->percentage(PHP_INT_MAX - 1, PHP_INT_MAX))->toBe('100')
        ->and($service->percentage(PHP_INT_MAX, 1))->toBe('922337203685477580700')
        ->and($service->percentage(PHP_INT_MIN, 1))->toBe('-922337203685477580800')
        ->and($service->percentage(PHP_INT_MIN, PHP_INT_MAX))->toBe('-100')
        ->and($service->percentage(1, 3))->toBe('33.33')
        ->and($service->percentage(2, 3))->toBe('66.67')
        ->and($service->percentage(-1, 32))->toBe('-3.13')
        ->and($service->percentage(0, 1))->toBe('0')
        ->and($service->percentage(1, 0))->toBeNull();
});

it('serializes large integer money and reconciles edits deletions and negative cash flow', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 0]);
    $income = Category::factory()->for($workspace)->income()->create();
    $expense = Category::factory()->for($workspace)->expense()->create();
    analyticsTransaction($workspace, $account, $income, 'income', 9007199254740993, '2026-11-01');
    $spent = analyticsTransaction($workspace, $account, $expense, 'expense', 9007199254740994, '2026-11-02');
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id]);
    $this->getJson('/analytics')->assertOk()
        ->assertJsonPath('summary.total_income', '9007199254740993')
        ->assertJsonPath('summary.net_cash_flow', '-1')
        ->assertJsonPath('summary.total_balance', '-1')
        ->assertJsonPath('summary.comparison.income_change_percentage', null);
    $spent->update(['amount' => 9007199254740993]);
    $this->getJson('/analytics')->assertOk()->assertJsonPath('summary.net_cash_flow', '0');
    $spent->delete();
    $this->getJson('/analytics')->assertOk()
        ->assertJsonPath('summary.total_expense', '0')
        ->assertJsonPath('summary.total_balance', '9007199254740993')
        ->assertJsonPath('summary.savings_rate', '100');
});

it('uses calendar days for custom comparison even when custom spans a full leap month', function () {
    [$user, $workspace] = analyticsWorkspace();
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id]);
    $this->getJson('/analytics?period=custom&date_from=2024-02-01&date_to=2024-02-29')
        ->assertOk()->assertJsonCount(29, 'trends')
        ->assertJsonPath('summary.comparison.previous_start', '2024-01-03')
        ->assertJsonPath('summary.comparison.previous_end', '2024-01-31');
    $this->getJson('/analytics?period=custom&date_from=2024-03-01&date_to=2024-03-01')
        ->assertOk()->assertJsonCount(1, 'trends')
        ->assertJsonPath('summary.comparison.previous_start', '2024-02-29')
        ->assertJsonPath('summary.comparison.previous_end', '2024-02-29');
    Carbon::setTestNow('2024-03-31 23:59:59');
    $this->getJson('/analytics?period=previous_month')->assertOk()
        ->assertJsonPath('period.start_date', '2024-02-01')
        ->assertJsonPath('period.end_date', '2024-02-29')
        ->assertJsonPath('summary.comparison.previous_start', '2024-01-01');
});

it('provides category and savings trends with zero income unavailable and strict 31 day granularity', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 0]);
    $income = Category::factory()->for($workspace)->income()->create();
    $expense = Category::factory()->for($workspace)->expense()->create(['is_active' => false]);
    analyticsTransaction($workspace, $account, $income, 'income', 100, '2026-11-01');
    analyticsTransaction($workspace, $account, $expense, 'expense', 150, '2026-11-01');
    analyticsTransaction($workspace, $account, $expense, 'expense', 10, '2026-11-30');
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id]);
    $this->getJson('/analytics')->assertOk()
        ->assertJsonPath('savings_rate_trends.0.savings_rate', '-50')
        ->assertJsonPath('savings_rate_trends.1.savings_rate', null)
        ->assertJsonPath('category_trends.0.category_id', $expense->id)
        ->assertJsonPath('category_trends.0.intervals.0.amount', '150')
        ->assertJsonPath('category_trends.0.intervals.1.amount', '0')
        ->assertJsonPath('category_trends.0.intervals.29.amount', '10');
    $this->getJson('/analytics?period=custom&date_from=2026-11-01&date_to=2026-12-01')
        ->assertOk()->assertJsonCount(31, 'trends');
    $this->getJson('/analytics?period=custom&date_from=2026-11-01&date_to=2026-12-02')
        ->assertOk()->assertJsonCount(2, 'trends')
        ->assertJsonPath('category_trends.0.intervals.0.amount', '160');
});

it('returns all overlapping active budgets in order using full month expenses', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create();
    $expense = Category::factory()->for($workspace)->expense()->create(['is_active' => false]);
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        Budget::factory()->for($workspace)->create([
            'created_by' => $user->id, 'period_start' => $month.'-01',
            'period_end' => Carbon::parse($month.'-01')->endOfMonth()->format('Y-m-d'),
            'total_amount' => 1000,
        ]);
    }
    Budget::factory()->for($workspace)->create([
        'created_by' => $user->id, 'period_start' => '2026-11-01',
        'period_end' => '2026-11-30', 'status' => 'archived', 'total_amount' => 500,
    ]);
    analyticsTransaction($workspace, $account, $expense, 'expense', 123, '2026-11-01');
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/analytics?period=custom&date_from=2026-11-15&date_to=2026-12-10')
        ->assertOk()->assertJsonCount(2, 'budget')
        ->assertJsonPath('summary.total_expense', '0')
        ->assertJsonPath('budget.0.period_start', '2026-11-01')
        ->assertJsonPath('budget.0.actual_amount', '123')
        ->assertJsonPath('budget.1.period_start', '2026-12-01');
});

it('allows viewers but requires authentication and rejects unapproved filters', function () {
    [$owner, $workspace] = analyticsWorkspace();
    $viewer = User::factory()->create();
    WorkspaceMember::factory()->for($workspace)->for($viewer)->create(['role' => 'viewer']);
    $this->getJson('/analytics')->assertUnauthorized();
    $this->get('/dashboard')->assertRedirect('/login');
    $this->actingAs($viewer)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/analytics')->assertOk();
    foreach (['last_30_days', 'last_90_days', 'this_year'] as $period) {
        $this->getJson('/analytics?period='.$period)->assertUnprocessable()->assertJsonValidationErrors('period');
    }
});

it('does not expose foreign related entities from inconsistent stored references', function () {
    [$user, $workspace] = analyticsWorkspace();
    [, $foreignWorkspace] = analyticsWorkspace();
    $localAccount = Account::factory()->for($workspace)->create();
    $foreignAccount = Account::factory()->for($foreignWorkspace)->create();
    $foreignCategory = Category::factory()->for($foreignWorkspace)->expense()->create();

    Transaction::factory()->for($workspace)->expense()->create([
        'amount' => 100,
        'transaction_date' => '2026-11-10',
        'account_id' => $foreignAccount->id,
        'category_id' => $foreignCategory->id,
        'created_by' => $user->id,
    ]);
    Transaction::factory()->for($workspace)->transfer()->create([
        'amount' => 50,
        'transaction_date' => '2026-11-11',
        'source_account_id' => $localAccount->id,
        'destination_account_id' => $foreignAccount->id,
        'created_by' => $user->id,
    ]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/analytics')->assertOk()
        ->assertJsonCount(0, 'expense_breakdown')
        ->assertJsonCount(0, 'category_trends')
        ->assertJsonPath('recent_transactions.0.destination_account', null)
        ->assertJsonPath('recent_transactions.0.source_account.id', $localAccount->id)
        ->assertJsonPath('recent_transactions.1.account', null)
        ->assertJsonPath('recent_transactions.1.category', null);
});

it('verifies explain plan and bounded query count on realistic fixture dataset', function () {
    [$user, $workspace] = analyticsWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 1000000]);
    $catIncome = Category::factory()->for($workspace)->income()->create();
    $catExpense = Category::factory()->for($workspace)->expense()->create();

    // EXPLAIN plan check: verifies index scan on transactions workspace_id and transaction_date
    $plan = DB::select(
        'EXPLAIN SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE workspace_id = ? AND transaction_date BETWEEN ? AND ? AND deleted_at IS NULL',
        [$workspace->id, '2026-11-01', '2026-11-30']
    );
    expect($plan)->not->toBeEmpty();
    $planText = collect($plan)->map(fn ($row) => (array) $row)->flatten()->join("\n");
    if (DB::connection()->getDriverName() === 'pgsql') {
        expect($planText)->toContain('Index Scan');
    }

    // Warm up session and default categories
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])->getJson('/analytics')->assertOk();

    // Populate realistic dataset (3 accounts, 5 categories, 20 transactions)
    $acc2 = Account::factory()->for($workspace)->create(['initial_balance' => 500000]);
    for ($i = 1; $i <= 10; $i++) {
        analyticsTransaction($workspace, $account, $catIncome, 'income', 100000 * $i, '2026-11-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT));
        analyticsTransaction($workspace, $acc2, $catExpense, 'expense', 40000 * $i, '2026-11-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT));
    }

    // Query count profiling
    Illuminate\Support\Facades\DB::enableQueryLog();
    Illuminate\Support\Facades\DB::flushQueryLog();

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/analytics?period=current_month')
        ->assertOk();

    $queries = Illuminate\Support\Facades\DB::getQueryLog();
    expect(count($queries))->toBeLessThanOrEqual(30);
});
