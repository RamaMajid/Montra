<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ManageWorkspace
{
    /**
     * @param  array{name: string, description?: string|null}  $data
     */
    public function createFamily(User $user, array $data): Workspace
    {
        return DB::transaction(function () use ($user, $data): Workspace {
            /** @var Workspace $workspace */
            $workspace = Workspace::create([
                'owner_id' => $user->id,
                'name' => $data['name'],
                'type' => 'family',
                'description' => $data['description'] ?? null,
            ]);
            $workspace->members()->create(['user_id' => $user->id, 'role' => 'owner', 'joined_at' => now()]);
            app(InitializeDefaultCategories::class)->for($workspace);

            return $workspace;
        });
    }

    /**
     * @param  array{email: string, role: string}  $data
     * @return array{0: WorkspaceInvitation, 1: string}
     */
    public function invite(User $inviter, Workspace $workspace, array $data): array
    {
        return DB::transaction(function () use ($inviter, $workspace, $data): array {
            /** @var Workspace $ws */
            $ws = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $inviterMember = $ws->membershipFor($inviter);
            if ($ws->type !== 'family' || ! $inviterMember || ! in_array($inviterMember->role, ['owner', 'admin'], true)) {
                throw new HttpException(403);
            }
            if (User::query()->where('email', $data['email'])->whereHas('workspaceMemberships', fn ($q) => $q->where('workspace_id', $ws->id))->exists()) {
                throw ValidationException::withMessages(['email' => 'User is already a member of this workspace.']);
            }
            if ($ws->invitations()->where('email', $data['email'])->whereNull('accepted_at')->whereNull('revoked_at')->where('expires_at', '>', now())->exists()) {
                throw ValidationException::withMessages(['email' => 'An active invitation already exists for this email.']);
            }
            $ws->invitations()->where('email', $data['email'])->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            $plain = Str::random(40);
            /** @var WorkspaceInvitation $inv */
            $inv = $ws->invitations()->create([
                'email' => $data['email'],
                'role' => $data['role'],
                'token_hash' => hash('sha256', $plain),
                'invited_by' => $inviter->id,
                'expires_at' => now()->addDays(7),
            ]);

            return [$inv, $plain];
        });
    }

    public function acceptInvite(User $user, string $token): Workspace
    {
        return DB::transaction(function () use ($user, $token): Workspace {
            $workspaceId = WorkspaceInvitation::query()->where('token_hash', hash('sha256', $token))->value('workspace_id');
            abort_unless($workspaceId, 404);
            $ws = Workspace::query()->whereKey($workspaceId)->lockForUpdate()->firstOrFail();
            $inv = WorkspaceInvitation::query()->where('token_hash', hash('sha256', $token))->lockForUpdate()->first();
            if (! $inv || $inv->accepted_at || $inv->revoked_at || $inv->expires_at->isPast() || mb_strtolower($inv->email) !== mb_strtolower($user->email)) {
                abort(404, 'Invalid invitation.');
            }
            if ($ws->members()->where('user_id', $user->id)->exists()) {
                abort(404, 'Invalid invitation.');
            }
            $ws->members()->create(['user_id' => $user->id, 'role' => $inv->role, 'joined_at' => now()]);
            $inv->update(['accepted_at' => now()]);

            return $ws;
        });
    }

    public function updateMemberRole(User $actor, Workspace $workspace, WorkspaceMember $member, string $newRole): void
    {
        DB::transaction(function () use ($actor, $workspace, $member, $newRole): void {
            /** @var Workspace $ws */
            $ws = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $actorMember = $ws->membershipFor($actor);
            /** @var WorkspaceMember $target */
            $target = WorkspaceMember::query()->whereKey($member->id)->lockForUpdate()->firstOrFail();
            if ($target->workspace_id !== $ws->id || $target->role === 'owner' || $target->user_id === $actor->id) {
                throw new HttpException(403);
            }
            if (! $actorMember || ! in_array($actorMember->role, ['owner', 'admin'], true)) {
                throw new HttpException(403);
            }
            $target->update(['role' => $newRole]);
        });
    }

    public function removeMember(User $actor, Workspace $workspace, WorkspaceMember $member): void
    {
        DB::transaction(function () use ($actor, $workspace, $member): void {
            /** @var Workspace $ws */
            $ws = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $actorMember = $ws->membershipFor($actor);
            /** @var WorkspaceMember $target */
            $target = WorkspaceMember::query()->whereKey($member->id)->lockForUpdate()->firstOrFail();
            if ($target->workspace_id !== $ws->id || $target->role === 'owner' || $target->user_id === $actor->id) {
                throw new HttpException(403);
            }
            if (! $actorMember || ! in_array($actorMember->role, ['owner', 'admin'], true)) {
                throw new HttpException(403);
            }
            $target->delete();
        });
    }

    public function transferOwnership(User $actor, Workspace $workspace, WorkspaceMember $newOwnerMember): void
    {
        DB::transaction(function () use ($actor, $workspace, $newOwnerMember): void {
            /** @var Workspace $ws */
            $ws = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            if ($ws->type !== 'family' || $ws->owner_id !== $actor->id) {
                throw new HttpException(403);
            }
            $currentOwner = $ws->membershipFor($actor);
            /** @var WorkspaceMember $target */
            $target = WorkspaceMember::query()->whereKey($newOwnerMember->id)->lockForUpdate()->firstOrFail();
            if ($target->workspace_id !== $ws->id || $target->user_id === $actor->id || ! $currentOwner) {
                throw new HttpException(403);
            }
            $ws->update(['owner_id' => $target->user_id]);
            $currentOwner->update(['role' => 'admin']);
            $target->update(['role' => 'owner']);
        });
    }
}
