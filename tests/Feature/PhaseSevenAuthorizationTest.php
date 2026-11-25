<?php

use App\Models\Account;
use App\Models\Category;
use App\Models\FinancialInsight;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Carbon;

function phaseSevenWorkspace(string $role = 'owner'): array
{
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $user = $role === 'owner' ? $owner : User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    if ($role !== 'owner') {
        WorkspaceMember::factory()->for($workspace)->for($user)->create(['role' => $role]);
    }

    return [$user, $workspace, $owner];
}

beforeEach(function () {
    Carbon::setTestNow('2026-11-20 12:00:00');
});

afterEach(function () {
    Carbon::setTestNow();
});

it('uses session workspace for GET intelligence and preserves source data and read state', function () {
    [$user, $workspace] = phaseSevenWorkspace();
    [, $foreignWorkspace] = phaseSevenWorkspace();
    $account = Account::factory()->for($workspace)->create(['initial_balance' => 5000000]);
    $category = Category::factory()->for($workspace)->income()->create();
    Transaction::factory()->for($workspace)->create([
        'type' => 'income',
        'amount' => 1000000,
        'transaction_date' => '2026-10-10',
        'account_id' => $account->id,
        'category_id' => $category->id,
        'source_account_id' => null,
        'destination_account_id' => null,
        'created_by' => $user->id,
    ]);
    $foreignInsight = FinancialInsight::factory()->for($foreignWorkspace)->create();

    $response = $this->actingAs($user)
        ->withSession(['active_workspace_id' => $workspace->id])
        ->getJson("/intelligence?workspace_id={$foreignWorkspace->id}");

    $response->assertOk();
    expect(FinancialInsight::where('workspace_id', $workspace->id)->count())->toBeGreaterThan(0)
        ->and(collect($response->json('insights'))->pluck('id'))->not->toContain($foreignInsight->id)
        ->and(Transaction::where('workspace_id', $workspace->id)->count())->toBe(1)
        ->and($account->fresh()->initial_balance)->toBe(5000000);

    $insight = FinancialInsight::where('workspace_id', $workspace->id)->firstOrFail();
    $insight->update(['is_read' => true]);

    $this->getJson('/intelligence')->assertOk();
    expect($insight->fresh()->is_read)->toBeTrue();
});

it('bulk mark as read is workspace scoped idempotent and denied to viewers', function () {
    [$owner, $workspace] = phaseSevenWorkspace();
    [, $foreignWorkspace] = phaseSevenWorkspace();
    $unread = FinancialInsight::factory()->for($workspace)->create(['is_read' => false]);
    $alreadyRead = FinancialInsight::factory()->for($workspace)->create(['is_read' => true]);
    $foreign = FinancialInsight::factory()->for($foreignWorkspace)->create(['is_read' => false]);

    $this->actingAs($owner)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson('/intelligence/read-all')
        ->assertOk()
        ->assertJsonPath('updated_count', 1);

    $this->postJson('/intelligence/read-all')->assertOk()->assertJsonPath('updated_count', 0);
    expect($unread->fresh()->is_read)->toBeTrue()
        ->and($alreadyRead->fresh()->is_read)->toBeTrue()
        ->and($foreign->fresh()->is_read)->toBeFalse();

    [$viewer, $viewerWorkspace] = phaseSevenWorkspace('viewer');
    FinancialInsight::factory()->for($viewerWorkspace)->create(['is_read' => false]);
    $this->actingAs($viewer)->withSession(['active_workspace_id' => $viewerWorkspace->id])
        ->postJson('/intelligence/read-all')
        ->assertForbidden();
});

it('enforces member ownership for contributions and viewer mutation denial', function () {
    [$member, $workspace] = phaseSevenWorkspace('member');
    $other = User::factory()->create(['email_verified_at' => now()]);
    WorkspaceMember::factory()->for($workspace)->for($other)->create(['role' => 'member']);
    $goal = SavingsGoal::factory()->for($workspace)->create(['created_by' => $other->id, 'target_amount' => 1000000]);

    $ownResponse = $this->actingAs($member)->withSession(['active_workspace_id' => $workspace->id])
        ->postJson("/savings-goals/{$goal->id}/contributions", [
            'amount' => 600000,
            'contribution_date' => '2026-11-10',
        ])
        ->assertCreated();
    $own = GoalContribution::findOrFail($ownResponse->json('contribution.id'));
    $otherContribution = GoalContribution::factory()->for($goal)->create(['created_by' => $other->id, 'amount' => 200000]);

    $this->putJson("/savings-goals/{$goal->id}/contributions/{$own->id}", [
        'amount' => 500000,
        'contribution_date' => '2026-11-10',
    ])->assertOk();
    $this->putJson("/savings-goals/{$goal->id}/contributions/{$otherContribution->id}", [
        'amount' => 100000,
        'contribution_date' => '2026-11-10',
    ])->assertForbidden();
    $this->deleteJson("/savings-goals/{$goal->id}/contributions/{$otherContribution->id}")->assertForbidden();
    $this->deleteJson("/savings-goals/{$goal->id}/contributions/{$own->id}")->assertOk();

    [$viewer, $viewerWorkspace] = phaseSevenWorkspace('viewer');
    $viewerGoal = SavingsGoal::factory()->for($viewerWorkspace)->create();
    $this->actingAs($viewer)->withSession(['active_workspace_id' => $viewerWorkspace->id])
        ->postJson("/savings-goals/{$viewerGoal->id}/contributions", [
            'amount' => 100000,
            'contribution_date' => '2026-11-10',
        ])->assertForbidden();
});
