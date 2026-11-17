<?php

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates exactly one personal workspace during registration', function () {
    $this->post('/register', [
        'name' => 'Rifki',
        'email' => 'rifki@example.test',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $user = User::where('email', 'rifki@example.test')->firstOrFail();

    expect(Workspace::where('owner_id', $user->id)->where('type', 'personal')->count())->toBe(1)
        ->and(WorkspaceMember::where('workspace_id', $user->ownedWorkspaces()->first()->id)->value('role'))->toBe('owner');
});

it('idempotently creates personal workspace for legacy user without one on access', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    expect(Workspace::where('owner_id', $user->id)->count())->toBe(0);

    $this->actingAs($user)->get('/dashboard')->assertOk();

    expect(Workspace::where('owner_id', $user->id)->where('type', 'personal')->count())->toBe(1);

    // Repeated access does not create duplicate
    $this->actingAs($user)->get('/dashboard')->assertOk();
    expect(Workspace::where('owner_id', $user->id)->where('type', 'personal')->count())->toBe(1);
});

it('validates workspace name requirement when creating family workspace', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user)->post('/workspaces', ['name' => ''])->assertSessionHasErrors('name');
});

it('creates family workspace with owner membership', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user)->post('/workspaces', ['name' => 'Family Ledger'])->assertRedirect();

    $workspace = Workspace::where('name', 'Family Ledger')->firstOrFail();

    expect($workspace->type)->toBe('family')
        ->and($workspace->membershipFor($user)?->role)->toBe('owner');
});

it('rejects selecting another users workspace as active', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $other = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->for($other, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($other)->create();

    $this->actingAs($user)->post('/workspaces/active', ['workspace_id' => $workspace->id])->assertNotFound();
});

it('transfers family workspace ownership and updates former owner to admin', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->family()->for($owner, 'owner')->create();
    $ownerMember = WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();

    $newOwner = User::factory()->create(['email_verified_at' => now()]);
    $newOwnerMember = WorkspaceMember::factory()->member()->for($workspace)->for($newOwner)->create();

    $this->actingAs($owner)->post("/workspaces/{$workspace->id}/members/{$newOwnerMember->id}/transfer-ownership")->assertRedirect();

    expect($workspace->fresh()->owner_id)->toBe($newOwner->id)
        ->and($ownerMember->fresh()->role)->toBe('admin')
        ->and($newOwnerMember->fresh()->role)->toBe('owner');
});

it('allows owner to delete family workspace and falls back to personal workspace', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $personal = Workspace::factory()->personal()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($personal)->for($owner)->create();

    $family = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($family)->for($owner)->create();

    $this->actingAs($owner)->delete("/workspaces/{$family->id}")->assertRedirect(route('dashboard'));

    expect(Workspace::find($family->id))->toBeNull()
        ->and(session('active_workspace_id'))->toBe($personal->id);
});

it('revokes pending invitations when deleting a family workspace', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $family = Workspace::factory()->family()->for($owner, 'owner')->create();
    WorkspaceMember::factory()->owner()->for($family)->for($owner)->create();
    $invitation = WorkspaceInvitation::factory()->for($family)->for($owner, 'inviter')->create();

    $this->actingAs($owner)->delete("/workspaces/{$family->id}")->assertRedirect(route('dashboard'));

    expect($invitation->fresh()->revoked_at)->not->toBeNull();
});
