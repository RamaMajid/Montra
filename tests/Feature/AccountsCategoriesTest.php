<?php

use App\Actions\Workspaces\InitializeDefaultCategories;
use App\Models\Account;
use App\Models\Category;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function phase2Workspace(string $role = 'owner'): array
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

it('initializes workspace-owned defaults once without undoing edits or archive', function () {
    [$user, $workspace] = phase2Workspace();

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])->get('/categories')->assertOk();
    expect($workspace->categories()->where('type', 'income')->count())->toBe(5)
        ->and($workspace->categories()->where('type', 'expense')->count())->toBe(10);

    $salary = $workspace->categories()->where('name', 'Salary')->firstOrFail();
    $salary->update(['name' => 'Main Salary', 'is_active' => false]);
    app(InitializeDefaultCategories::class)->for($workspace->fresh());

    expect($workspace->categories()->count())->toBe(15)
        ->and($salary->fresh()->name)->toBe('Main Salary')
        ->and($salary->fresh()->is_active)->toBeFalse();
});

it('allows owner and admin writes while member and viewer remain read only', function (string $role, int $writeStatus) {
    [$user, $workspace] = phase2Workspace($role);
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->get('/accounts')->assertOk();
    $this->actingAs($user)->withSession($session)->post('/accounts', [
        'name' => "{$role} account",
        'type' => 'cash',
        'initial_balance' => '1000',
    ])->assertStatus($writeStatus);
})->with([
    ['owner', 302],
    ['admin', 302],
    ['member', 403],
    ['viewer', 403],
]);

it('validates account integer range negative semantics and duplicate names', function () {
    [$user, $workspace] = phase2Workspace();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post('/accounts', [
        'name' => 'Cash Wallet', 'type' => 'cash', 'initial_balance' => '-1',
    ])->assertSessionHasErrors('initial_balance');

    $this->actingAs($user)->withSession($session)->post('/accounts', [
        'name' => 'Credit Account', 'type' => 'bank', 'initial_balance' => '-500000',
    ])->assertRedirect();

    expect(Account::where('name', 'Credit Account')->value('initial_balance'))->toBe(-500000);

    $this->actingAs($user)->withSession($session)->post('/accounts', [
        'name' => 'credit account', 'type' => 'other', 'initial_balance' => '0',
    ])->assertSessionHasErrors('name');

    $this->actingAs($user)->withSession($session)->post('/accounts', [
        'name' => 'Huge', 'type' => 'bank', 'initial_balance' => '9223372036854775808',
    ])->assertSessionHasErrors('initial_balance');
});

it('archives and restores accounts without deleting them', function () {
    [$user, $workspace] = phase2Workspace();
    $account = Account::factory()->for($workspace)->create();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post("/accounts/{$account->id}/archive")->assertRedirect();
    expect($account->fresh()->is_active)->toBeFalse()->and($account->fresh()->deleted_at)->toBeNull();

    $this->actingAs($user)->withSession($session)->post("/accounts/{$account->id}/restore")->assertRedirect();
    expect($account->fresh()->is_active)->toBeTrue();
});

it('creates edits archives and restores categories while keeping type immutable', function () {
    [$user, $workspace] = phase2Workspace();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post('/categories', [
        'name' => 'Pets', 'type' => 'expense', 'color' => '#34785A',
    ])->assertRedirect();
    $category = Category::where('workspace_id', $workspace->id)->where('name', 'Pets')->firstOrFail();

    $this->actingAs($user)->withSession($session)->put("/categories/{$category->id}", [
        'name' => 'Pet Care', 'type' => 'income',
    ])->assertSessionHasErrors('type');

    $this->actingAs($user)->withSession($session)->post("/categories/{$category->id}/archive")->assertRedirect();
    expect($category->fresh()->is_active)->toBeFalse()->and($category->fresh()->deleted_at)->toBeNull();
    $this->actingAs($user)->withSession($session)->post("/categories/{$category->id}/restore")->assertRedirect();
    expect($category->fresh()->is_active)->toBeTrue();
});

it('enforces active workspace isolation for account and category ids', function () {
    [$user, $workspace] = phase2Workspace();
    [, $foreignWorkspace] = phase2Workspace();
    $foreignAccount = Account::factory()->for($foreignWorkspace)->create();
    $foreignCategory = Category::factory()->for($foreignWorkspace)->create();
    $session = ['active_workspace_id' => $workspace->id];

    $this->actingAs($user)->withSession($session)->post("/accounts/{$foreignAccount->id}/archive")->assertNotFound();
    $this->actingAs($user)->withSession($session)->put("/accounts/{$foreignAccount->id}", [
        'name' => 'Stolen', 'type' => 'bank', 'initial_balance' => '0',
    ])->assertNotFound();
    $this->actingAs($user)->withSession($session)->post("/categories/{$foreignCategory->id}/archive")->assertNotFound();
    $this->actingAs($user)->withSession($session)->put("/categories/{$foreignCategory->id}", [
        'name' => 'Stolen', 'type' => 'expense',
    ])->assertNotFound();
});
