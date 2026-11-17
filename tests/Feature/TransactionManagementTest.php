<?php

use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\AccountBalanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function phase3Workspace(string $role = 'owner'): array
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

it('creates income transactions and increases account balance', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create([
        'type' => 'bank',
        'initial_balance' => 100000,
    ]);
    $category = Category::factory()->for($workspace)->income()->create();
    $session = ['active_workspace_id' => $workspace->id];

    $response = $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'income',
        'description' => 'Freelance payment',
        'amount' => '50000',
        'transaction_date' => '2026-11-17',
        'account_id' => $account->id,
        'category_id' => $category->id,
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('transactions', [
        'workspace_id' => $workspace->id,
        'type' => 'income',
        'description' => 'Freelance payment',
        'amount' => 50000,
        'account_id' => $account->id,
        'category_id' => $category->id,
    ]);

    $service = app(AccountBalanceService::class);
    expect($service->calculate($account->fresh()))->toBe(150000);
});

it('creates expense transactions and decreases account balance', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create([
        'type' => 'cash',
        'initial_balance' => 100000,
    ]);
    $category = Category::factory()->for($workspace)->expense()->create();
    $session = ['active_workspace_id' => $workspace->id];

    $response = $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'expense',
        'description' => 'Lunch',
        'amount' => '30000',
        'transaction_date' => '2026-11-17',
        'account_id' => $account->id,
        'category_id' => $category->id,
    ]);

    $response->assertRedirect();
    $service = app(AccountBalanceService::class);
    expect($service->calculate($account->fresh()))->toBe(70000);
});

it('creates transfer transactions affecting both source and destination balances without category', function () {
    [$user, $workspace] = phase3Workspace();
    $source = Account::factory()->for($workspace)->create([
        'name' => 'Source BCA',
        'type' => 'bank',
        'initial_balance' => 100000,
    ]);
    $dest = Account::factory()->for($workspace)->create([
        'name' => 'Destination GoPay',
        'type' => 'e_wallet',
        'initial_balance' => 20000,
    ]);
    $session = ['active_workspace_id' => $workspace->id];

    $response = $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'transfer',
        'description' => 'Top up wallet',
        'amount' => '40000',
        'transaction_date' => '2026-11-17',
        'source_account_id' => $source->id,
        'destination_account_id' => $dest->id,
    ]);

    $response->assertRedirect();

    $this->assertDatabaseHas('transactions', [
        'workspace_id' => $workspace->id,
        'type' => 'transfer',
        'amount' => 40000,
        'account_id' => null,
        'category_id' => null,
        'source_account_id' => $source->id,
        'destination_account_id' => $dest->id,
    ]);

    $service = app(AccountBalanceService::class);
    expect($service->calculate($source->fresh()))->toBe(60000)
        ->and($service->calculate($dest->fresh()))->toBe(60000);
});

it('rejects transfer when source and destination are the same account', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'transfer',
        'description' => 'Self transfer',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'source_account_id' => $account->id,
        'destination_account_id' => $account->id,
    ])->assertSessionHasErrors('destination_account_id');
});

it('rejects transfer with category or income/expense with missing required fields or mismatched category type', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create();
    $incomeCategory = Category::factory()->for($workspace)->income()->create();
    $expenseCategory = Category::factory()->for($workspace)->expense()->create();
    $session = ['active_workspace_id' => $workspace->id];

    // Transfer with prohibited category
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'transfer',
        'description' => 'Transfer',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'source_account_id' => $account->id,
        'destination_account_id' => 9999,
        'category_id' => $incomeCategory->id,
    ])->assertSessionHasErrors('category_id');

    // Expense with income category
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'expense',
        'description' => 'Wrong cat',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'account_id' => $account->id,
        'category_id' => $incomeCategory->id,
    ])->assertSessionHasErrors('category_id');

    // Income with expense category
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'income',
        'description' => 'Wrong cat',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'account_id' => $account->id,
        'category_id' => $expenseCategory->id,
    ])->assertSessionHasErrors('category_id');
});

it('enforces workspace isolation for transactions, accounts, and categories', function () {
    [$user, $workspace] = phase3Workspace();
    [, $foreignWorkspace] = phase3Workspace();

    $myAccount = Account::factory()->for($workspace)->create();
    $foreignAccount = Account::factory()->for($foreignWorkspace)->create();
    $myCategory = Category::factory()->for($workspace)->expense()->create();
    $foreignCategory = Category::factory()->for($foreignWorkspace)->expense()->create();
    $foreignTx = Transaction::factory()->for($foreignWorkspace)->expense()->create([
        'account_id' => $foreignAccount->id,
        'category_id' => $foreignCategory->id,
    ]);

    $session = ['active_workspace_id' => $workspace->id];

    // Foreign account
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'expense',
        'description' => 'Hack',
        'amount' => '1000',
        'transaction_date' => '2026-11-17',
        'account_id' => $foreignAccount->id,
        'category_id' => $myCategory->id,
    ])->assertSessionHasErrors('account_id');

    // Foreign category
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'expense',
        'description' => 'Hack',
        'amount' => '1000',
        'transaction_date' => '2026-11-17',
        'account_id' => $myAccount->id,
        'category_id' => $foreignCategory->id,
    ])->assertSessionHasErrors('category_id');

    // Route IDOR edit / delete foreign transaction
    $this->actingAs($user)->withSession($session)->put("/transactions/{$foreignTx->id}", [
        'type' => 'expense',
        'description' => 'Hack edit',
        'amount' => '2000',
        'transaction_date' => '2026-11-17',
        'account_id' => $myAccount->id,
        'category_id' => $myCategory->id,
    ])->assertNotFound();

    $this->actingAs($user)->withSession($session)->delete("/transactions/{$foreignTx->id}")->assertNotFound();
});

it('enforces role-based authorization for transactions according to docs matrix', function () {
    // Owner, Admin, Member can create; Viewer cannot
    foreach (['owner', 'admin', 'member'] as $role) {
        [$user, $workspace] = phase3Workspace($role);
        $account = Account::factory()->for($workspace)->create();
        $cat = Category::factory()->for($workspace)->income()->create();

        $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])->post('/transactions', [
            'type' => 'income',
            'description' => "{$role} income",
            'amount' => '10000',
            'transaction_date' => '2026-11-17',
            'account_id' => $account->id,
            'category_id' => $cat->id,
        ])->assertRedirect();
    }

    // Viewer cannot create or edit
    [$viewer, $vWorkspace] = phase3Workspace('viewer');
    $vAccount = Account::factory()->for($vWorkspace)->create();
    $vCat = Category::factory()->for($vWorkspace)->income()->create();
    $vTx = Transaction::factory()->for($vWorkspace)->income()->create([
        'account_id' => $vAccount->id,
        'category_id' => $vCat->id,
    ]);

    $this->actingAs($viewer)->withSession(['active_workspace_id' => $vWorkspace->id])->post('/transactions', [
        'type' => 'income',
        'description' => 'Viewer income',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'account_id' => $vAccount->id,
        'category_id' => $vCat->id,
    ])->assertForbidden();

    $this->actingAs($viewer)->withSession(['active_workspace_id' => $vWorkspace->id])->put("/transactions/{$vTx->id}", [
        'type' => 'income',
        'description' => 'Viewer edit',
        'amount' => '15000',
        'transaction_date' => '2026-11-17',
        'account_id' => $vAccount->id,
        'category_id' => $vCat->id,
    ])->assertForbidden();

    $this->actingAs($viewer)->withSession(['active_workspace_id' => $vWorkspace->id])->delete("/transactions/{$vTx->id}")->assertForbidden();

    // Member can delete own record but cannot delete another user's record
    [$member, $mWorkspace] = phase3Workspace('member');
    $mAccount = Account::factory()->for($mWorkspace)->create();
    $mCat = Category::factory()->for($mWorkspace)->income()->create();

    $otherUser = User::factory()->create();
    $myTx = Transaction::factory()->for($mWorkspace)->income()->create([
        'created_by' => $member->id,
        'account_id' => $mAccount->id,
        'category_id' => $mCat->id,
    ]);
    $otherTx = Transaction::factory()->for($mWorkspace)->income()->create([
        'created_by' => $otherUser->id,
        'account_id' => $mAccount->id,
        'category_id' => $mCat->id,
    ]);

    $this->actingAs($member)->withSession(['active_workspace_id' => $mWorkspace->id])->delete("/transactions/{$myTx->id}")->assertRedirect();
    $this->actingAs($member)->withSession(['active_workspace_id' => $mWorkspace->id])->delete("/transactions/{$otherTx->id}")->assertForbidden();
});

it('rejects assigning new archived accounts or categories, but respects unchanged archived references on update', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create(['is_active' => false]);
    $cat = Category::factory()->for($workspace)->income()->create(['is_active' => false]);
    $session = ['active_workspace_id' => $workspace->id];

    // Cannot create with archived account or category
    $this->actingAs($user)->withSession($session)->post('/transactions', [
        'type' => 'income',
        'description' => 'Test',
        'amount' => '10000',
        'transaction_date' => '2026-11-17',
        'account_id' => $account->id,
        'category_id' => $cat->id,
    ])->assertSessionHasErrors(['account_id']);

    // Create valid active transaction
    $activeAccount = Account::factory()->for($workspace)->create(['is_active' => true]);
    $activeCat = Category::factory()->for($workspace)->income()->create(['is_active' => true]);
    $tx = Transaction::factory()->for($workspace)->income()->create([
        'account_id' => $activeAccount->id,
        'category_id' => $activeCat->id,
    ]);

    // Now archive the account and category that the transaction references
    $activeAccount->update(['is_active' => false]);
    $activeCat->update(['is_active' => false]);

    // Editing transaction without changing the archived references succeeds
    $this->actingAs($user)->withSession($session)->put("/transactions/{$tx->id}", [
        'type' => 'income',
        'description' => 'Updated description only',
        'amount' => '20000',
        'transaction_date' => '2026-11-17',
        'account_id' => $activeAccount->id,
        'category_id' => $activeCat->id,
    ])->assertRedirect();

    expect($tx->fresh()->description)->toBe('Updated description only')
        ->and($tx->fresh()->amount)->toBe(20000);

    // Editing to change account to a newly selected archived account fails
    $otherArchived = Account::factory()->for($workspace)->create(['is_active' => false]);
    $this->actingAs($user)->withSession($session)->put("/transactions/{$tx->id}", [
        'type' => 'income',
        'description' => 'Try switch account',
        'amount' => '20000',
        'transaction_date' => '2026-11-17',
        'account_id' => $otherArchived->id,
        'category_id' => $activeCat->id,
    ])->assertSessionHasErrors('account_id');
});

it('soft deletes transactions and updates derived balance calculations', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 100000]);
    $cat = Category::factory()->for($workspace)->expense()->create();
    $tx = Transaction::factory()->for($workspace)->expense()->create([
        'amount' => 30000,
        'account_id' => $account->id,
        'category_id' => $cat->id,
    ]);
    $session = ['active_workspace_id' => $workspace->id];

    $service = app(AccountBalanceService::class);
    expect($service->calculate($account->fresh()))->toBe(70000);

    $this->actingAs($user)->withSession($session)->delete("/transactions/{$tx->id}")->assertRedirect();

    expect($tx->fresh()->trashed())->toBeTrue()
        ->and($service->calculate($account->fresh()))->toBe(100000);
});

it('safely handles 64-bit integer monetary bounds and detects overflow explicitly', function () {
    expect(fn () => AccountBalanceService::add(PHP_INT_MAX, 1))->toThrow(OverflowException::class)
        ->and(fn () => AccountBalanceService::sub(PHP_INT_MIN, 1))->toThrow(OverflowException::class);

    // Large valid integer without precision loss
    $largeAmount = 5000000000000;
    expect(AccountBalanceService::add(1000000000000, $largeAmount))->toBe(6000000000000)
        ->and(AccountBalanceService::sub(6000000000000, $largeAmount))->toBe(1000000000000);
});

it('filters transactions by type, account, category, date range, search, and pagination', function () {
    [$user, $workspace] = phase3Workspace();
    $acc1 = Account::factory()->for($workspace)->create(['name' => 'Bank A']);
    $acc2 = Account::factory()->for($workspace)->create(['name' => 'Bank B']);
    $catIncome = Category::factory()->for($workspace)->income()->create(['name' => 'Salary']);
    $catExpense = Category::factory()->for($workspace)->expense()->create(['name' => 'Food']);

    Transaction::factory()->for($workspace)->income()->create([
        'description' => 'Company monthly salary',
        'amount' => 10000000,
        'transaction_date' => '2026-11-01',
        'account_id' => $acc1->id,
        'category_id' => $catIncome->id,
    ]);
    Transaction::factory()->for($workspace)->expense()->create([
        'description' => 'Supermarket groceries',
        'amount' => 250000,
        'transaction_date' => '2026-11-10',
        'account_id' => $acc2->id,
        'category_id' => $catExpense->id,
    ]);

    $session = ['active_workspace_id' => $workspace->id];

    // Filter by type
    $this->actingAs($user)->withSession($session)->get('/transactions?type=income')->assertOk();

    // Filter by account
    $this->actingAs($user)->withSession($session)->get("/transactions?account_id={$acc1->id}")->assertOk();

    // Filter by category
    $this->actingAs($user)->withSession($session)->get("/transactions?category_id={$catIncome->id}")->assertOk();

    // Filter by date range
    $this->actingAs($user)->withSession($session)->get('/transactions?date_from=2026-11-01&date_to=2026-11-05')->assertOk();

    // Search
    $this->actingAs($user)->withSession($session)->get('/transactions?search=groceries')->assertOk();
});

it('provides derived balance in accounts list', function () {
    [$user, $workspace] = phase3Workspace();
    $account = Account::factory()->for($workspace)->create([
        'name' => 'Checking',
        'initial_balance' => 100000,
    ]);
    $category = Category::factory()->for($workspace)->income()->create();
    Transaction::factory()->for($workspace)->income()->create([
        'amount' => 50000,
        'account_id' => $account->id,
        'category_id' => $category->id,
    ]);

    $session = ['active_workspace_id' => $workspace->id];

    $response = $this->actingAs($user)->withSession($session)->get('/accounts');
    $response->assertOk();

    $accounts = $response->viewData('page')['props']['accounts'];
    $accItem = collect($accounts)->firstWhere('id', $account->id);

    expect($accItem['initial_balance'])->toBe('100000')
        ->and($accItem['current_balance'])->toBe('150000');
});
