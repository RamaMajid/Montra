<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('limits workspace settings and invitation writes by role', function (string $role, int $status) {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    $user = $role === 'owner' ? $owner : User::factory()->create(['email_verified_at' => now()]);
    if ($role !== 'owner') {
        WorkspaceMember::factory()->for($workspace)->for($user)->create(['role' => $role]);
    }

    $this->actingAs($user)->put("/workspaces/{$workspace->id}", ['name' => 'Renamed'])->assertStatus($status);
    $this->actingAs($user)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'next@example.test', 'role' => 'member'])->assertStatus($status);
})->with([
    ['owner', 302],
    ['admin', 302],
    ['member', 403],
    ['viewer', 403],
]);

it('denies outsider access with 404 across all read and mutation endpoints', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    $ownerMember = WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    $outsider = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($outsider)->get("/workspaces/{$workspace->id}")->assertNotFound();
    $this->actingAs($outsider)->put("/workspaces/{$workspace->id}", ['name' => 'Hacked'])->assertNotFound();
    $this->actingAs($outsider)->delete("/workspaces/{$workspace->id}")->assertNotFound();
    $this->actingAs($outsider)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'hacked@example.test', 'role' => 'member'])->assertNotFound();
    $this->actingAs($outsider)->put("/workspaces/{$workspace->id}/members/{$ownerMember->id}", ['role' => 'member'])->assertNotFound();
    $this->actingAs($outsider)->delete("/workspaces/{$workspace->id}/members/{$ownerMember->id}")->assertNotFound();
    $this->actingAs($outsider)->post("/workspaces/{$workspace->id}/members/{$ownerMember->id}/transfer-ownership")->assertNotFound();
});

it('only shares explicitly selected workspace and member fields', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();

    $this->actingAs($owner)->get('/workspaces')->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/index')
        ->where('workspaces.0', [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'type' => $workspace->type,
            'description' => $workspace->description,
            'role' => 'owner',
        ]));

    $this->actingAs($owner)->get("/workspaces/{$workspace->id}")->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/show')
        ->where('workspace.members.0', [
            'id' => $workspace->membershipFor($owner)->id,
            'user_id' => $owner->id,
            'role' => 'owner',
            'user' => [
                'id' => $owner->id,
                'name' => $owner->name,
                'email' => $owner->email,
            ],
        ])
        ->where('workspace.id', $workspace->id)
        ->where('workspace.name', $workspace->name)
        ->where('workspace.type', $workspace->type)
        ->where('workspace.description', $workspace->description));
});

it('prevents admin from editing owner or transferring ownership', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->for($owner, 'owner')->create();
    $ownerMember = WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    $admin = User::factory()->create(['email_verified_at' => now()]);
    WorkspaceMember::factory()->admin()->for($workspace)->for($admin)->create();

    $this->actingAs($admin)->put("/workspaces/{$workspace->id}/members/{$ownerMember->id}", ['role' => 'member'])->assertForbidden();
    $this->actingAs($admin)->post("/workspaces/{$workspace->id}/members/{$ownerMember->id}/transfer-ownership")->assertForbidden();
});

it('prevents admin from self-escalation or self-removal', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $adminMember = WorkspaceMember::factory()->admin()->for($workspace)->for($admin)->create();

    $this->actingAs($admin)->put("/workspaces/{$workspace->id}/members/{$adminMember->id}", ['role' => 'admin'])->assertForbidden();
    $this->actingAs($admin)->delete("/workspaces/{$workspace->id}/members/{$adminMember->id}")->assertForbidden();
});

it('disallows deleting or transferring a personal workspace', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $personal = Workspace::factory()->personal()->for($owner, 'owner')->create();
    $ownerMember = WorkspaceMember::factory()->owner()->for($personal)->for($owner)->create();

    $otherUser = User::factory()->create(['email_verified_at' => now()]);
    $otherMember = WorkspaceMember::factory()->member()->for($personal)->for($otherUser)->create();

    $this->actingAs($owner)->delete("/workspaces/{$personal->id}")->assertForbidden();
    $this->actingAs($owner)->post("/workspaces/{$personal->id}/members/{$otherMember->id}/transfer-ownership")->assertForbidden();
});

it('prevents transferring family workspace ownership to self or non-member', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $family = Workspace::factory()->family()->for($owner, 'owner')->create();
    $ownerMember = WorkspaceMember::factory()->owner()->for($family)->for($owner)->create();

    $otherFamily = Workspace::factory()->family()->create();
    $unrelatedMember = WorkspaceMember::factory()->create(['workspace_id' => $otherFamily->id]);

    $this->actingAs($owner)->post("/workspaces/{$family->id}/members/{$ownerMember->id}/transfer-ownership")->assertForbidden();
    $this->actingAs($owner)->post("/workspaces/{$family->id}/members/{$unrelatedMember->id}/transfer-ownership")->assertForbidden();
});

it('blocks account deletion when user owns family workspace with remaining members', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $family = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($family)->for($owner)->create();
    $memberUser = User::factory()->create(['email_verified_at' => now()]);
    WorkspaceMember::factory()->member()->for($family)->for($memberUser)->create();

    $this->actingAs($owner)->delete(route('profile.destroy'), [
        'password' => 'password',
    ])->assertSessionHasErrors('password');

    expect($owner->fresh())->not->toBeNull();
});

it('allows account deletion when user owns only personal and sole-member workspaces', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $personal = Workspace::factory()->personal()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($personal)->for($owner)->create();
    $soloFamily = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($soloFamily)->for($owner)->create();

    $this->actingAs($owner)->delete(route('profile.destroy'), [
        'password' => 'password',
    ])->assertSessionHasNoErrors()->assertRedirect(route('home'));

    expect($owner->fresh())->toBeNull()
        ->and(Workspace::find($personal->id))->toBeNull()
        ->and(Workspace::find($soloFamily->id))->toBeNull();
});
