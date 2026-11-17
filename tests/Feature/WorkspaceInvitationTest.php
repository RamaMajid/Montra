<?php

use App\Actions\Workspaces\ManageWorkspace;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function familyWorkspaceWithOwner(): array
{
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $workspace = Workspace::factory()->for($owner, 'owner')->family()->create();
    WorkspaceMember::factory()->owner()->for($workspace)->for($owner)->create();

    return [$owner, $workspace];
}

it('creates hashed email-bound single-use invitation', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();

    $this->actingAs($owner)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'INVITEE@EXAMPLE.TEST', 'role' => 'member'])->assertRedirect();

    $invitation = WorkspaceInvitation::firstOrFail();
    expect($invitation->email)->toBe('invitee@example.test')
        ->and($invitation->token_hash)->not->toBe('');
});

it('accepts invitation only for invited email and only once', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    [, $token] = app(ManageWorkspace::class)->invite($owner, $workspace, ['email' => 'invitee@example.test', 'role' => 'member']);
    $invitee = User::factory()->create(['email' => 'invitee@example.test', 'email_verified_at' => now()]);

    $this->actingAs($invitee)->post("/invitations/{$token}/accept")->assertRedirect();
    $this->actingAs($invitee)->post("/invitations/{$token}/accept")->assertNotFound();

    expect($workspace->fresh()->membershipFor($invitee)?->role)->toBe('member');
});

it('rejects duplicate active invitations for the same email', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();

    $this->actingAs($owner)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'duplicate@example.test', 'role' => 'member'])->assertRedirect();
    $this->actingAs($owner)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'duplicate@example.test', 'role' => 'member'])->assertSessionHasErrors('email');
});

it('rejects inviting a user who is already a member', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    $member = User::factory()->create(['email' => 'existing@example.test', 'email_verified_at' => now()]);
    WorkspaceMember::factory()->member()->for($workspace)->for($member)->create();

    $this->actingAs($owner)->post("/workspaces/{$workspace->id}/invitations", ['email' => 'existing@example.test', 'role' => 'member'])->assertSessionHasErrors('email');
});

it('rejects acceptance if invitation is expired', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    $plain = '1234567890123456789012345678901234567890';
    WorkspaceInvitation::factory()->expired()->for($workspace)->for($owner, 'inviter')->create([
        'email' => 'expired@example.test',
        'token_hash' => hash('sha256', $plain),
    ]);
    $invitee = User::factory()->create(['email' => 'expired@example.test', 'email_verified_at' => now()]);

    $this->actingAs($invitee)->get("/invitations/{$plain}/accept")->assertNotFound();
    $this->actingAs($invitee)->post("/invitations/{$plain}/accept")->assertNotFound();
});

it('rejects acceptance if invitation is revoked', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    [, $token] = app(ManageWorkspace::class)->invite($owner, $workspace, ['email' => 'revoked@example.test', 'role' => 'member']);
    $invitation = WorkspaceInvitation::where('email', 'revoked@example.test')->firstOrFail();

    $this->actingAs($owner)->delete("/workspaces/{$workspace->id}/invitations/{$invitation->id}")->assertRedirect();
    expect($invitation->fresh()->revoked_at)->not->toBeNull();

    $invitee = User::factory()->create(['email' => 'revoked@example.test', 'email_verified_at' => now()]);
    $this->actingAs($invitee)->get("/invitations/{$token}/accept")->assertNotFound();
    $this->actingAs($invitee)->post("/invitations/{$token}/accept")->assertNotFound();
});

it('rejects acceptance when authenticated user email does not match invitation', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    [, $token] = app(ManageWorkspace::class)->invite($owner, $workspace, ['email' => 'correct@example.test', 'role' => 'member']);
    $wrongUser = User::factory()->create(['email' => 'wrong@example.test', 'email_verified_at' => now()]);

    $this->actingAs($wrongUser)->get("/invitations/{$token}/accept")->assertNotFound();
    $this->actingAs($wrongUser)->post("/invitations/{$token}/accept")->assertNotFound();
});

it('blocks unverified user from accessing or confirming invitations', function () {
    [$owner, $workspace] = familyWorkspaceWithOwner();
    [, $token] = app(ManageWorkspace::class)->invite($owner, $workspace, ['email' => 'unverified@example.test', 'role' => 'member']);
    $unverifiedUser = User::factory()->create(['email' => 'unverified@example.test', 'email_verified_at' => null]);

    $this->actingAs($unverifiedUser)->get("/invitations/{$token}/accept")->assertRedirect(route('verification.notice'));
    $this->actingAs($unverifiedUser)->post("/invitations/{$token}/accept")->assertRedirect(route('verification.notice'));
});
