<?php

namespace App\Policies;

use App\Models\SavingsGoal;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

class SavingsGoalPolicy
{
    public function viewAny(User $user, Workspace $workspace): Response
    {
        return $workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function view(User $user, SavingsGoal $savingsGoal): Response
    {
        return $savingsGoal->workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot create savings goals.');
    }

    public function update(User $user, SavingsGoal $savingsGoal): Response
    {
        $membership = $savingsGoal->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            || ($membership->role === 'member' && (int) $savingsGoal->created_by === (int) $user->id)
            ? Response::allow()
            : Response::deny('You do not have permission to edit this savings goal.');
    }

    public function delete(User $user, SavingsGoal $savingsGoal): Response
    {
        $membership = $savingsGoal->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            || ($membership->role === 'member' && (int) $savingsGoal->created_by === (int) $user->id)
            ? Response::allow()
            : Response::deny('You do not have permission to archive this savings goal.');
    }
}
