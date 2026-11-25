<?php

use App\Models\Account;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\AccountBalanceService;
use App\Services\SavingsGoalService;

function savingsWorkspace(string $role = 'owner'): array
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

it('creates a savings goal with target amount and date', function () {
    [$user, $workspace] = savingsWorkspace();

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson('/savings-goals', [
            'name' => 'Dana Darurat 2027',
            'description' => 'Target tabungan darurat keluarga',
            'target_amount' => 12000000,
            'target_date' => '2027-12-31',
        ]);

    $response->assertCreated()
        ->assertJsonPath('goal.name', 'Dana Darurat 2027')
        ->assertJsonPath('goal.target_amount', '12000000')
        ->assertJsonPath('goal.status', 'active')
        ->assertJsonPath('goal.progress.total_contributions', '0')
        ->assertJsonPath('goal.progress.remaining_amount', '12000000')
        ->assertJsonPath('goal.progress.progress_percentage', '0');

    $this->assertDatabaseHas('savings_goals', [
        'workspace_id' => $workspace->id,
        'name' => 'Dana Darurat 2027',
        'target_amount' => 12000000,
        'status' => 'active',
    ]);
});

it('lists savings goals with progress and summary', function () {
    [$user, $workspace] = savingsWorkspace();

    $goal1 = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Goal 1',
        'target_amount' => 1000000,
        'created_by' => $user->id,
    ]);
    $goal2 = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Goal 2',
        'target_amount' => 2000000,
        'created_by' => $user->id,
    ]);

    GoalContribution::factory()->for($goal1)->create(['amount' => 500000, 'created_by' => $user->id]);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson('/savings-goals');

    $response->assertOk()
        ->assertJsonPath('summary.total_goals', 2)
        ->assertJsonPath('summary.active_goals', 2)
        ->assertJsonPath('summary.total_target_amount', '3000000')
        ->assertJsonPath('summary.total_saved_amount', '500000')
        ->assertJsonCount(2, 'goals');
});

it('shows savings goal detail with contribution history', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Liburan Akhir Tahun',
        'target_amount' => 5000000,
        'created_by' => $user->id,
    ]);

    GoalContribution::factory()->for($goal)->create([
        'amount' => 1000000,
        'contribution_date' => '2026-11-10',
        'notes' => 'Setoran awal',
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson("/savings-goals/{$goal->id}");

    $response->assertOk()
        ->assertJsonPath('goal.name', 'Liburan Akhir Tahun')
        ->assertJsonPath('goal.progress.total_contributions', '1000000')
        ->assertJsonPath('goal.progress.remaining_amount', '4000000')
        ->assertJsonPath('goal.progress.progress_percentage', '20')
        ->assertJsonCount(1, 'contributions')
        ->assertJsonPath('contributions.0.amount', '1000000')
        ->assertJsonPath('contributions.0.notes', 'Setoran awal');
});

it('updates a savings goal', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'name' => 'Old Name',
        'target_amount' => 5000000,
        'created_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->putJson("/savings-goals/{$goal->id}", [
            'name' => 'New Name',
            'target_amount' => 8000000,
        ]);

    $response->assertOk()
        ->assertJsonPath('goal.name', 'New Name')
        ->assertJsonPath('goal.target_amount', '8000000');

    expect($goal->fresh()->name)->toBe('New Name')
        ->and($goal->fresh()->target_amount)->toBe(8000000);
});

it('synchronizes goal status when its target changes', function (string $initialStatus, int $initialTarget, int $target, string $expectedStatus) {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'target_amount' => $initialTarget,
        'status' => $initialStatus,
    ]);
    GoalContribution::factory()->for($goal)->create(['amount' => 750000, 'created_by' => $user->id]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->putJson("/savings-goals/{$goal->id}", ['name' => $goal->name, 'target_amount' => $target])
        ->assertOk()
        ->assertJsonPath('goal.status', $expectedStatus)
        ->assertJsonPath('goal.progress.status', $expectedStatus);

    $this->assertDatabaseHas('savings_goals', ['id' => $goal->id, 'target_amount' => $target, 'status' => $expectedStatus]);
})->with([
    'active to completed' => ['active', 1000000, 500000, 'completed'],
    'completed to active' => ['completed', 500000, 1000000, 'active'],
    'archived remains archived' => ['archived', 1000000, 500000, 'archived'],
]);

it('archives a savings goal', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'created_by' => $user->id,
        'status' => 'active',
    ]);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/archive");

    $response->assertOk()
        ->assertJsonPath('message', 'Savings goal archived.');

    expect($goal->fresh()->status)->toBe('archived');
});

it('records contribution and transitions goal to completed when target reached', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'target_amount' => 1000000,
        'status' => 'active',
        'created_by' => $user->id,
    ]);

    // Contribution 1: 600.000 (60%)
    $res1 = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", [
            'amount' => 600000,
            'contribution_date' => '2026-11-15',
            'notes' => 'Cicilan 1',
        ]);

    $res1->assertCreated()
        ->assertJsonPath('goal_progress.total_contributions', '600000')
        ->assertJsonPath('goal_progress.remaining_amount', '400000')
        ->assertJsonPath('goal_progress.progress_percentage', '60')
        ->assertJsonPath('goal_progress.is_completed', false);

    expect($goal->fresh()->status)->toBe('active');

    // Contribution 2: 400.000 (reaching 100%)
    $res2 = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", [
            'amount' => 400000,
            'contribution_date' => '2026-11-19',
            'notes' => 'Cicilan pelunasan',
        ]);

    $res2->assertCreated()
        ->assertJsonPath('goal_progress.total_contributions', '1000000')
        ->assertJsonPath('goal_progress.remaining_amount', '0')
        ->assertJsonPath('goal_progress.progress_percentage', '100')
        ->assertJsonPath('goal_progress.is_completed', true);

    expect($goal->fresh()->status)->toBe('completed');
});

it('reverts status from completed to active when contribution is deleted', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->create([
        'target_amount' => 1000000,
        'created_by' => $user->id,
    ]);

    $c1 = GoalContribution::factory()->for($goal)->create(['amount' => 600000, 'created_by' => $user->id]);
    $c2 = GoalContribution::factory()->for($goal)->create(['amount' => 400000, 'created_by' => $user->id]);

    app(SavingsGoalService::class)->syncStatus($goal);
    expect($goal->fresh()->status)->toBe('completed');

    // Delete c2
    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->deleteJson("/savings-goals/{$goal->id}/contributions/{$c2->id}");

    $response->assertOk()
        ->assertJsonPath('goal_progress.total_contributions', '600000')
        ->assertJsonPath('goal_progress.remaining_amount', '400000')
        ->assertJsonPath('goal_progress.is_completed', false);

    expect($goal->fresh()->status)->toBe('active');
});

it('cannot add contribution to an archived goal', function () {
    [$user, $workspace] = savingsWorkspace();
    $goal = SavingsGoal::factory()->for($workspace)->archived()->create(['created_by' => $user->id]);

    $response = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", [
            'amount' => 100000,
            'contribution_date' => '2026-11-19',
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('savings_goal');
});

it('contributions do not mutate account balances or create transactions', function () {
    [$user, $workspace] = savingsWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 5000000]);
    $goal = SavingsGoal::factory()->for($workspace)->create(['target_amount' => 2000000, 'created_by' => $user->id]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", [
            'amount' => 500000,
            'contribution_date' => '2026-11-19',
        ])
        ->assertCreated();

    // Verify transactions count in database did not change
    expect(Transaction::where('workspace_id', $workspace->id)->count())->toBe(0);

    // Verify account balance remains exactly initial_balance
    $balanceService = app(AccountBalanceService::class);
    expect($balanceService->calculate($account))->toBe(5000000);
});

it('enforces workspace isolation for goals and contributions', function () {
    [$user, $workspace] = savingsWorkspace();
    $otherWorkspace = Workspace::factory()->create();
    $otherGoal = SavingsGoal::factory()->for($otherWorkspace)->create(['target_amount' => 1000000]);
    $otherContrib = GoalContribution::factory()->for($otherGoal)->create(['amount' => 100000]);

    // View other goal -> 404
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson("/savings-goals/{$otherGoal->id}")
        ->assertNotFound();

    // Update other goal -> 404
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->putJson("/savings-goals/{$otherGoal->id}", ['name' => 'Hacked', 'target_amount' => 1000])
        ->assertNotFound();

    // Archive other goal -> 404
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$otherGoal->id}/archive")
        ->assertNotFound();

    // Add contribution to other goal -> 404
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$otherGoal->id}/contributions", ['amount' => 50000, 'contribution_date' => '2026-11-19'])
        ->assertNotFound();

    // Delete contribution of other goal -> 404
    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->deleteJson("/savings-goals/{$otherGoal->id}/contributions/{$otherContrib->id}")
        ->assertNotFound();
});

it('enforces role authorization on goals and contributions', function () {
    [$viewer, $workspace] = savingsWorkspace('viewer');
    [$member] = savingsWorkspace('member');
    WorkspaceMember::factory()->for($workspace)->for($member)->create(['role' => 'member']);

    $goal = SavingsGoal::factory()->for($workspace)->create(['created_by' => $workspace->owner_id]);

    // Viewer cannot create goal
    $this->actingAs($viewer)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson('/savings-goals', ['name' => 'Goal', 'target_amount' => 100000])
        ->assertForbidden();

    // Viewer cannot contribute
    $this->actingAs($viewer)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", ['amount' => 100000, 'contribution_date' => '2026-11-19'])
        ->assertForbidden();

    // Member cannot archive a goal created by someone else
    $this->actingAs($member)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/archive")
        ->assertForbidden();

    // Member CAN create their own goal and archive their own goal
    $ownGoal = SavingsGoal::factory()->for($workspace)->create(['created_by' => $member->id]);
    $this->actingAs($member)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$ownGoal->id}/archive")
        ->assertOk();
});

it('enforces goal editing permissions for each workspace role', function (string $role, bool $ownGoal, bool $allowed) {
    [$user, $workspace] = savingsWorkspace($role);
    $creator = $ownGoal ? $user : User::factory()->create();
    $goal = SavingsGoal::factory()->for($workspace)->create(['created_by' => $creator->id]);

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->getJson("/savings-goals/{$goal->id}")
        ->assertOk()
        ->assertJsonPath('goal.can_edit', $allowed);

    $response = $this->putJson("/savings-goals/{$goal->id}", ['name' => 'Updated', 'target_amount' => 1000000]);
    if ($allowed) {
        $response->assertOk()->assertJsonPath('goal.can_edit', true);
    } else {
        $response->assertForbidden();
    }

    $this->assertDatabaseHas('savings_goals', [
        'id' => $goal->id,
        'name' => $allowed ? 'Updated' : $goal->name,
        'created_by' => $creator->id,
    ]);
})->with([
    'owner edits another goal' => ['owner', false, true],
    'admin edits another goal' => ['admin', false, true],
    'member edits own goal' => ['member', true, true],
    'member cannot edit another goal' => ['member', false, false],
    'viewer cannot edit own goal' => ['viewer', true, false],
    'viewer cannot edit another goal' => ['viewer', false, false],
]);

it('handles large integer monetary amounts safely', function () {
    [$user, $workspace] = savingsWorkspace();
    $largeTarget = 1000000000000; // 1 Triliun IDR
    $largeContrib = 500000000000; // 500 Miliar IDR

    $res = $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson('/savings-goals', [
            'name' => 'Dana Abadi',
            'target_amount' => $largeTarget,
        ]);

    $res->assertCreated()
        ->assertJsonPath('goal.target_amount', (string) $largeTarget);

    $goalId = $res->json('goal.id');

    $this->actingAs($user)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goalId}/contributions", [
            'amount' => $largeContrib,
            'contribution_date' => '2026-11-19',
        ])
        ->assertCreated()
        ->assertJsonPath('goal_progress.total_contributions', (string) $largeContrib)
        ->assertJsonPath('goal_progress.remaining_amount', (string) ($largeTarget - $largeContrib))
        ->assertJsonPath('goal_progress.progress_percentage', '50');
});
