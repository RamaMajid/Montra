<?php

namespace App\Policies;

use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class GoalContributionPolicy
{
    public function viewAny(User $user, SavingsGoal $savingsGoal): Response
    {
        return $savingsGoal->workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function view(User $user, GoalContribution $goalContribution): Response
    {
        return $goalContribution->savingsGoal->workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user, SavingsGoal $savingsGoal): Response
    {
        $membership = $savingsGoal->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot record goal contributions.');
    }

    public function update(User $user, GoalContribution $goalContribution): Response
    {
        $membership = $goalContribution->savingsGoal->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            || ($membership->role === 'member' && (int) $goalContribution->created_by === (int) $user->id)
            ? Response::allow()
            : Response::deny('You do not have permission to edit this contribution.');
    }

    public function delete(User $user, GoalContribution $goalContribution): Response
    {
        $membership = $goalContribution->savingsGoal->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            || ($membership->role === 'member' && (int) $goalContribution->created_by === (int) $user->id)
            ? Response::allow()
            : Response::deny('You do not have permission to delete this contribution.');
    }
}
