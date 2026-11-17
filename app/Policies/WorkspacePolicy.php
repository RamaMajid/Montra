<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Auth\Access\Response;

class WorkspacePolicy
{
    public function view(User $user, Workspace $workspace): Response
    {
        return $workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function update(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            ? Response::allow()
            : Response::deny('Only owners and admins can update this workspace.');
    }

    public function manageMembers(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        if ($workspace->type !== 'family') {
            return Response::deny('Only family workspaces support member management.');
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            ? Response::allow()
            : Response::deny('Only owners and admins can manage members.');
    }

    public function manageMember(User $user, Workspace $workspace, WorkspaceMember $member): Response
    {
        $manageResponse = $this->manageMembers($user, $workspace);
        if ($manageResponse->denied()) {
            return $manageResponse;
        }

        if ((int) $member->workspace_id !== (int) $workspace->id) {
            return Response::denyAsNotFound();
        }

        if ($member->role === 'owner') {
            return Response::deny('Cannot edit or remove the workspace owner.');
        }

        if ((int) $member->user_id === (int) $user->id) {
            return Response::deny('Cannot edit or remove yourself.');
        }

        return Response::allow();
    }

    public function transferOwnership(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        if ($workspace->type !== 'family') {
            return Response::deny('Personal workspaces cannot transfer ownership.');
        }

        if ((int) $workspace->owner_id !== (int) $user->id || $membership->role !== 'owner') {
            return Response::deny('Only the owner can transfer workspace ownership.');
        }

        return Response::allow();
    }

    public function delete(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        if ($workspace->type !== 'family') {
            return Response::deny('Personal workspaces cannot be deleted.');
        }

        if ((int) $workspace->owner_id !== (int) $user->id || $membership->role !== 'owner') {
            return Response::deny('Only the owner can delete the workspace.');
        }

        return Response::allow();
    }
}
