<?php

use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\Intelligence\Rules\UnusualTransactionRule;
use Illuminate\Support\Carbon;

function unusualTestWorkspace(): array
{
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->personal()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();

    return [$owner, $workspace];
}

function unusualTx(Workspace $workspace, string $type, int $amount, string $date, ?Category $cat = null): Transaction
{
    if ($type === 'transfer') {
        $src = Account::factory()->for($workspace)->create(['initial_balance' => 100000000000]);
        $dst = Account::factory()->for($workspace)->create(['initial_balance' => 100000000000]);

        return Transaction::factory()->for($workspace)->create([
            'type' => 'transfer',
            'amount' => $amount,
            'transaction_date' => $date,
            'account_id' => null,
            'category_id' => null,
            'source_account_id' => $src->id,
            'destination_account_id' => $dst->id,
            'created_by' => $workspace->owner_id,
        ]);
    }

    $account = Account::factory()->for($workspace)->create(['initial_balance' => 100000000000]);
    $cat = $cat ?? ($type === 'income'
        ? Category::factory()->for($workspace)->income()->create()
        : Category::factory()->for($workspace)->expense()->create());

    return Transaction::factory()->for($workspace)->create([
        'type' => $type,
        'amount' => $amount,
        'transaction_date' => $date,
        'account_id' => $account->id,
        'category_id' => $cat->id,
        'source_account_id' => null,
        'destination_account_id' => null,
        'created_by' => $workspace->owner_id,
    ]);
}

it('requires at least 3 baseline expenses occurring strictly before candidate transaction_date', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // Only 2 historical expenses before candidate on 2026-11-10
    unusualTx($workspace, 'expense', 200000, '2026-10-15', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-10-20', $cat);

    // Current period large expense on 2026-11-10
    unusualTx($workspace, 'expense', 5000000, '2026-11-10', $cat);

    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toBeEmpty();

    // Expense on the SAME day (2026-11-10) or LATER day (2026-11-15) does NOT count toward candidate's historical baseline
    unusualTx($workspace, 'expense', 200000, '2026-11-10', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-11-15', $cat);
    expect($rule->evaluate($workspace, $startDate, $endDate))->toBeEmpty();

    // Add 3rd expense strictly before 2026-11-10 (e.g., 2026-11-05) -> baseline is now 3
    unusualTx($workspace, 'expense', 200000, '2026-11-05', $cat);

    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toHaveCount(1)
        ->and($insights[0]['rule_key'])->toBe('unusual_expense')
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('200000')
        ->and($insights[0]['supporting_data']['threshold'])->toBe('600001')
        ->and($insights[0]['supporting_data']['amount'])->toBe('5000000');
});

it('enforces strict greater-than 3x historical average and 500.000 minimum candidate amount', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // 3 historical expenses of 200.000 -> Avg = 200.000, 3x Avg = 600.000
    unusualTx($workspace, 'expense', 200000, '2026-10-01', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-10-02', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-10-03', $cat);

    // Candidate 500.000 (>= min 500k, but <= 600k) -> NOT unusual
    unusualTx($workspace, 'expense', 500000, '2026-11-05', $cat);
    expect($rule->evaluate($workspace, $startDate, $endDate))->toBeEmpty();

    // Candidate 600.000 (exactly 3x average) -> NOT unusual (strict > required)
    $exactTx = unusualTx($workspace, 'expense', 600000, '2026-11-05', $cat);
    expect($rule->evaluate($workspace, $startDate, $endDate))->toBeEmpty();
    $exactTx->delete();

    // Candidate 600.001 (> 3x average and >= 500.000) -> UNUSUAL
    unusualTx($workspace, 'expense', 600001, '2026-11-05', $cat);
    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toHaveCount(1)
        ->and($insights[0]['supporting_data']['amount'])->toBe('600001')
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('200000')
        ->and($insights[0]['supporting_data']['threshold'])->toBe('600001');
});

it('uses minimum absolute threshold of 500.000 when 3x average is smaller', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // 3 historical expenses averaging 100.000 -> 3x is 300.000, but min candidate amount is 500.000
    unusualTx($workspace, 'expense', 100000, '2026-10-01', $cat);
    unusualTx($workspace, 'expense', 100000, '2026-10-02', $cat);
    unusualTx($workspace, 'expense', 100000, '2026-10-03', $cat);

    // 300.000 and 300.001 and 499.999 are < 500.000 -> should not trigger
    unusualTx($workspace, 'expense', 300000, '2026-11-05', $cat);
    unusualTx($workspace, 'expense', 300001, '2026-11-05', $cat);
    unusualTx($workspace, 'expense', 499999, '2026-11-05', $cat);

    expect($rule->evaluate($workspace, $startDate, $endDate))->toBeEmpty();

    // 500.000 is >= 500.000 AND > 300.000 (3x avg) -> triggers
    unusualTx($workspace, 'expense', 500000, '2026-11-05', $cat);

    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toHaveCount(1)
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('100000')
        ->and($insights[0]['supporting_data']['threshold'])->toBe('500000')
        ->and($insights[0]['supporting_data']['amount'])->toBe('500000');
});

it('ignores deleted transactions, income, transfers, and other workspaces in baseline', function () {
    [, $workspace1] = unusualTestWorkspace();
    [, $workspace2] = unusualTestWorkspace();
    $cat1 = Category::factory()->for($workspace1)->expense()->create();
    $cat2 = Category::factory()->for($workspace2)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // Only 2 valid historical expenses for workspace1
    unusualTx($workspace1, 'expense', 100000, '2026-10-01', $cat1);
    unusualTx($workspace1, 'expense', 100000, '2026-10-02', $cat1);

    // Historical income and transfer for workspace1 (should be ignored)
    unusualTx($workspace1, 'income', 100000, '2026-10-03');
    unusualTx($workspace1, 'transfer', 100000, '2026-10-04');

    // Soft-deleted historical expense for workspace1 (should be ignored)
    $deletedTx = unusualTx($workspace1, 'expense', 100000, '2026-10-05', $cat1);
    $deletedTx->delete();

    // Historical expense for workspace2 (should be ignored)
    unusualTx($workspace2, 'expense', 100000, '2026-10-06', $cat2);

    // Candidate unusual transaction in workspace1
    unusualTx($workspace1, 'expense', 1000000, '2026-11-10', $cat1);

    // Baseline count for workspace1 is only 2 -> empty
    expect($rule->evaluate($workspace1, $startDate, $endDate))->toBeEmpty();

    // Now add 3rd valid expense to workspace1
    unusualTx($workspace1, 'expense', 100000, '2026-10-07', $cat1);

    $insights = $rule->evaluate($workspace1, $startDate, $endDate);
    expect($insights)->toHaveCount(1)
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('100000');
});

it('excludes candidate from baseline regardless of insertion order', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // Insert candidate FIRST (earlier created_at / id, but later transaction_date)
    unusualTx($workspace, 'expense', 600001, '2026-11-15', $cat);

    // Insert historical transactions AFTER candidate
    unusualTx($workspace, 'expense', 200000, '2026-10-20', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-10-10', $cat);
    unusualTx($workspace, 'expense', 200000, '2026-10-05', $cat);

    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toHaveCount(1)
        ->and($insights[0]['supporting_data']['amount'])->toBe('600001')
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('200000')
        ->and($insights[0]['supporting_data']['threshold'])->toBe('600001');
});

it('limits returned unusual transactions to top 5 ordered by amount descending', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // 3 historical baseline expenses
    unusualTx($workspace, 'expense', 100000, '2026-10-01', $cat);
    unusualTx($workspace, 'expense', 100000, '2026-10-02', $cat);
    unusualTx($workspace, 'expense', 100000, '2026-10-03', $cat);

    // 7 unusual expenses on same day in current period so they share the exact 100k baseline
    for ($i = 1; $i <= 7; $i++) {
        unusualTx($workspace, 'expense', 1000000 * $i, '2026-11-10', $cat);
    }

    $insights = $rule->evaluate($workspace, $startDate, $endDate);
    expect($insights)->toHaveCount(5);

    $amounts = array_map(fn ($ins) => (int) $ins['supporting_data']['amount'], $insights);
    expect($amounts)->toBe([7000000, 6000000, 5000000, 4000000, 3000000]);
});

it('calculates average and threshold safely with large BIGINT integers without float or overflow', function () {
    [, $workspace] = unusualTestWorkspace();
    $cat = Category::factory()->for($workspace)->expense()->create();
    $rule = app(UnusualTransactionRule::class);

    $startDate = Carbon::parse('2026-11-01');
    $endDate = Carbon::parse('2026-11-30');

    // 3 large historical expenses: 1.000.000.000.000 (1 Triliun), 2 Triliun, 3 Triliun
    // Avg = 2.000.000.000.000 (2 Triliun), 3x Avg = 6.000.000.000.000
    unusualTx($workspace, 'expense', 1000000000000, '2026-10-01', $cat);
    unusualTx($workspace, 'expense', 2000000000000, '2026-10-02', $cat);
    unusualTx($workspace, 'expense', 3000000000000, '2026-10-03', $cat);

    // Exact 3x average (6 Triliun) should NOT trigger
    $exact = unusualTx($workspace, 'expense', 6000000000000, '2026-11-05', $cat);
    expect($rule->evaluate($workspace, $startDate, $endDate))->toBeEmpty();
    $exact->delete();

    // 6.000.000.000.001 triggers (> 3x average)
    unusualTx($workspace, 'expense', 6000000000001, '2026-11-06', $cat);
    $insights = $rule->evaluate($workspace, $startDate, $endDate);

    expect($insights)->toHaveCount(1)
        ->and($insights[0]['supporting_data']['average_expense'])->toBe('2000000000000')
        ->and($insights[0]['supporting_data']['threshold'])->toBe('6000000000001')
        ->and($insights[0]['supporting_data']['amount'])->toBe('6000000000001')
        ->and($insights[0]['description'])->toContain('Rp 6.000.000.000.001')
        ->and($insights[0]['description'])->toContain('Rp 2.000.000.000.000');
});
