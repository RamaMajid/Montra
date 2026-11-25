<?php

use App\Models\Account;
use App\Models\Budget;
use App\Models\BudgetCategory;
use App\Models\Category;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Carbon;

function reportWorkspace(string $role = 'owner'): array
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

function reportTx(Workspace $workspace, Account $account, Category $category, string $type, int $amount, string $date): Transaction
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

/** @return array<int, array<int, string>> */
function parseCsv(string $csv): array
{
    $lines = array_values(array_filter(explode("\n", trim($csv)), fn (string $l): bool => $l !== ''));

    return array_map(fn (string $l): array => str_getcsv($l, ',', '"', ''), $lines);
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-25 12:00:00');
});

afterEach(function () {
    Carbon::setTestNow();
});

it('reconciles monthly-summary, income, expense and category reports with analytics and excludes transfers, deleted rows and goal contributions', function () {
    [$user, $workspace] = reportWorkspace();
    $src = Account::factory()->for($workspace)->create(['initial_balance' => 1000000, 'is_active' => true]);
    $dst = Account::factory()->for($workspace)->create(['initial_balance' => 500000, 'is_active' => true]);
    $salary = Category::factory()->for($workspace)->income()->create(['name' => 'Gaji']);
    $bonus = Category::factory()->for($workspace)->income()->create(['name' => 'Bonus']);
    $food = Category::factory()->for($workspace)->expense()->create(['name' => 'Makan']);
    $rent = Category::factory()->for($workspace)->expense()->create(['name' => 'Sewa']);

    reportTx($workspace, $src, $salary, 'income', 10000000, '2026-11-01');
    reportTx($workspace, $src, $bonus, 'income', 2500000, '2026-11-30');
    reportTx($workspace, $src, $food, 'expense', 1500000, '2026-11-10');
    reportTx($workspace, $src, $food, 'expense', 500000, '2026-11-15');
    reportTx($workspace, $src, $rent, 'expense', 3000000, '2026-11-05');

    // Out-of-period transaction (counted only in previous-month comparison & live balance)
    reportTx($workspace, $src, $food, 'expense', 400000, '2026-10-31');

    // Soft-deleted expense must be ignored
    reportTx($workspace, $src, $food, 'expense', 999999, '2026-11-12')->delete();

    // Transfer moves money between accounts; never income/expense/net cash flow
    Transaction::factory()->for($workspace)->create([
        'type' => 'transfer',
        'amount' => 800000,
        'transaction_date' => '2026-11-18',
        'account_id' => null,
        'category_id' => null,
        'source_account_id' => $src->id,
        'destination_account_id' => $dst->id,
        'created_by' => $user->id,
    ]);

    // Goal contribution must not count as expense or alter account balance
    $goal = SavingsGoal::factory()->for($workspace)->create(['target_amount' => 5000000, 'created_by' => $user->id]);
    GoalContribution::factory()->for($goal)->create(['amount' => 2000000, 'contribution_date' => '2026-11-20', 'created_by' => $user->id]);

    $session = ['active_workspace_id' => $workspace->id];
    $analytics = $this->actingAs($user)->withSession($session)->getJson('/analytics')->assertOk()->json('summary');

    $summary = $this->withSession($session)->getJson('/reports/monthly-summary')->assertOk()->json();
    $byMetric = collect($summary['rows'])->pluck('value', 'metric');
    expect($summary['totals'])->toBe([
        'total_income' => '12500000',
        'total_expense' => '5000000',
        'net_cash_flow' => '7500000',
    ])
        ->and($byMetric['total_income'])->toBe($analytics['total_income'])
        ->and($byMetric['total_expense'])->toBe($analytics['total_expense'])
        ->and($byMetric['net_cash_flow'])->toBe($analytics['net_cash_flow'])
        ->and($byMetric['total_balance'])->toBe($analytics['total_balance'])->toBe('8600000')
        ->and($byMetric['savings_rate'])->toBe('60')
        ->and($byMetric['transfer_count'])->toBe('1');

    $income = $this->withSession($session)->getJson('/reports/income')->assertOk()->json();
    expect($income['totals'])->toBe(['total_income' => '12500000'])
        ->and($income['rows'])->toHaveCount(2)
        ->and($income['rows'][0])->toMatchArray(['type' => 'income', 'category_name' => 'Gaji', 'amount' => '10000000', 'transaction_count' => 1, 'percentage' => '80'])
        ->and($income['rows'][1])->toMatchArray(['type' => 'income', 'category_name' => 'Bonus', 'amount' => '2500000', 'transaction_count' => 1, 'percentage' => '20']);

    $expense = $this->withSession($session)->getJson('/reports/expense')->assertOk()->json();
    expect($expense['totals'])->toBe(['total_expense' => '5000000'])
        ->and($expense['rows'])->toHaveCount(2)
        ->and($expense['rows'][0])->toMatchArray(['type' => 'expense', 'category_name' => 'Sewa', 'amount' => '3000000', 'transaction_count' => 1, 'percentage' => '60'])
        ->and($expense['rows'][1])->toMatchArray(['type' => 'expense', 'category_name' => 'Makan', 'amount' => '2000000', 'transaction_count' => 2, 'percentage' => '40']);

    $category = $this->withSession($session)->getJson('/reports/category')->assertOk()->json();
    expect($category['totals'])->toBe([
        'total_income' => '12500000',
        'total_expense' => '5000000',
        'net_cash_flow' => '7500000',
    ])->and($category['rows'])->toHaveCount(4);
});

it('builds budget and savings reports from existing services and ignores archived records', function () {
    [$user, $workspace] = reportWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 10000000, 'is_active' => true]);
    $food = Category::factory()->for($workspace)->expense()->create(['name' => 'Makan']);

    $budget = Budget::factory()->for($workspace)->create([
        'name' => 'November 2026',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'total_amount' => 4000000,
        'status' => 'active',
    ]);
    BudgetCategory::factory()->for($budget)->for($food)->create(['allocated_amount' => 2000000]);
    Budget::factory()->for($workspace)->create([
        'name' => 'Archived Nov',
        'period_start' => '2026-11-01',
        'period_end' => '2026-11-30',
        'total_amount' => 9000000,
        'status' => 'archived',
    ]);
    reportTx($workspace, $account, $food, 'expense', 1500000, '2026-11-12');

    $activeGoal = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Dana Darurat',
        'target_amount' => 10000000,
        'target_date' => '2027-06-01',
        'status' => 'active',
        'created_by' => $user->id,
    ]);
    GoalContribution::factory()->for($activeGoal)->create(['amount' => 2500000, 'contribution_date' => '2026-11-10', 'created_by' => $user->id]);
    SavingsGoal::factory()->for($workspace)->create(['name' => 'Archived Goal', 'target_amount' => 99000000, 'status' => 'archived', 'created_by' => $user->id]);

    $session = ['active_workspace_id' => $workspace->id];
    $budgetReport = $this->actingAs($user)->withSession($session)->getJson('/reports/budget')->assertOk()->json();
    expect($budgetReport['totals'])->toBe(['total_budgeted' => '4000000', 'total_actual' => '1500000'])
        ->and($budgetReport['rows'])->toHaveCount(2)
        ->and($budgetReport['rows'][0])->toMatchArray(['budget_name' => 'November 2026', 'category_name' => '', 'budgeted_amount' => '4000000', 'actual_amount' => '1500000', 'remaining_amount' => '2500000'])
        ->and($budgetReport['rows'][1])->toMatchArray(['category_name' => 'Makan', 'budgeted_amount' => '2000000', 'actual_amount' => '1500000', 'utilization' => '75', 'warning' => 'warning']);

    $savingsReport = $this->withSession($session)->getJson('/reports/savings')->assertOk()->json();
    expect($savingsReport['totals'])->toBe(['total_target' => '10000000', 'total_saved' => '2500000'])
        ->and($savingsReport['rows'])->toHaveCount(1)
        ->and($savingsReport['rows'][0])->toMatchArray([
            'name' => 'Dana Darurat',
            'target_date' => '2027-06-01',
            'target_amount' => '10000000',
            'total_contributions' => '2500000',
            'remaining_amount' => '7500000',
            'progress_percentage' => '25',
        ]);
});

it('handles period filters, custom boundaries, empty periods and invalid inputs consistently', function () {
    [$user, $workspace] = reportWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 0, 'is_active' => true]);
    $cat = Category::factory()->for($workspace)->expense()->create(['name' => 'Transport']);

    reportTx($workspace, $account, $cat, 'expense', 100000, '2024-02-28');
    reportTx($workspace, $account, $cat, 'expense', 200000, '2024-02-29'); // leap day
    reportTx($workspace, $account, $cat, 'expense', 400000, '2024-03-01');

    $session = ['active_workspace_id' => $workspace->id];
    $leap = $this->actingAs($user)->withSession($session)
        ->getJson('/reports/expense?period=custom&date_from=2024-02-29&date_to=2024-02-29')
        ->assertOk()
        ->json();
    expect($leap['period'])->toBe(['type' => 'custom', 'start_date' => '2024-02-29', 'end_date' => '2024-02-29'])
        ->and($leap['totals'])->toBe(['total_expense' => '200000']);

    $empty = $this->withSession($session)->getJson('/reports/income?period=previous_month')->assertOk()->json();
    expect($empty['period'])->toBe(['type' => 'previous_month', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31'])
        ->and($empty['rows'])->toBe([])
        ->and($empty['totals'])->toBe(['total_income' => '0']);

    $this->withSession($session)->getJson('/reports/expense?period=custom&date_from=2026-11-10&date_to=2026-11-01')->assertUnprocessable();
    $this->withSession($session)->getJson('/reports/unknown-type')->assertNotFound();
    $this->withSession($session)->get('/reports/unknown-type/export')->assertNotFound();
});

it('streams CSV exports with integer amounts, neutralises formula injection and leaves no disk files', function () {
    [$user, $workspace] = reportWorkspace('viewer');
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 1000000, 'is_active' => true]);
    $unsafeCat = Category::factory()->for($workspace)->expense()->create(['name' => '=cmd|\' /C calc\'!A0']);
    reportTx($workspace, $account, $unsafeCat, 'expense', 750000, '2026-11-10');

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->get('/reports/expense/export?period=current_month');

    $response->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8')
        ->assertDownload('montra-expense-2026-11-01-2026-11-30.csv');

    $rows = parseCsv($response->streamedContent());
    expect($rows[0])->toBe(['type', 'category_id', 'category_name', 'amount', 'transaction_count', 'percentage'])
        ->and($rows[1][2])->toBe("'=cmd|' /C calc'!A0")
        ->and($rows[1][3])->toBe('750000')
        ->and($rows[1][5])->toBe('100');

    // Negative cash flow numeric string must NOT be prefixed with an apostrophe
    $summaryCsv = parseCsv(
        $this->withSession(['active_workspace_id' => $workspace->id])
            ->get('/reports/monthly-summary/export')
            ->assertOk()
            ->streamedContent()
    );
    $netRow = collect($summaryCsv)->firstWhere(0, 'net_cash_flow');
    expect($netRow[1])->toBe('-750000');

    // Empty report still emits the header row
    $emptyCsv = parseCsv(
        $this->withSession(['active_workspace_id' => $workspace->id])
            ->get('/reports/income/export')
            ->assertOk()
            ->streamedContent()
    );
    expect($emptyCsv)->toBe([['type', 'category_id', 'category_name', 'amount', 'transaction_count', 'percentage']]);
});

it('enforces workspace isolation and allows every workspace role to view and export reports', function () {
    [, $foreign] = reportWorkspace();
    $fAcc = Account::factory()->for($foreign)->create(['initial_balance' => 9000000, 'is_active' => true]);
    $fCat = Category::factory()->for($foreign)->income()->create(['name' => 'Secret']);
    reportTx($foreign, $fAcc, $fCat, 'income', 9000000, '2026-11-10');

    foreach (['owner', 'admin', 'member', 'viewer'] as $role) {
        [$user, $workspace] = reportWorkspace($role);
        $json = $this->actingAs($user)
            ->withSession(['active_workspace_id' => $workspace->id])
            ->getJson("/reports/income?workspace_id={$foreign->id}")
            ->assertOk()
            ->json();

        expect($json['rows'])->toBe([])
            ->and($json['totals']['total_income'])->toBe('0');

        $csv = parseCsv(
            $this->withSession(['active_workspace_id' => $workspace->id])
                ->get("/reports/income/export?workspace_id={$foreign->id}")
                ->assertOk()
                ->streamedContent()
        );
        expect($csv)->toHaveCount(1);
    }
});
