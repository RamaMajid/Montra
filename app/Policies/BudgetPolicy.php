<?php

namespace App\Policies;

use App\Models\Budget;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

class BudgetPolicy
{
    public function viewAny(User $user, Workspace $workspace): Response
    {
        return $workspace->membershipFor($user) ? Response::allow() : Response::denyAsNotFound();
    }

    public function view(User $user, Budget $budget): Response
    {
        return $budget->workspace->membershipFor($user) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot create budgets.');
    }

    public function update(User $user, Budget $budget): Response
    {
        $membership = $budget->workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return $this->canEdit($user, $budget) ? Response::allow() : Response::deny('Viewers cannot edit budgets.');
    }

    public function delete(User $user, Budget $budget): Response
    {
        $membership = $budget->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin'], true)
            || ($membership->role === 'member' && (int) $budget->created_by === (int) $user->id)
            ? Response::allow()
            : Response::deny('You do not have permission to archive this budget.');
    }

    private function canEdit(User $user, Budget $budget): bool
    {
        $membership = $budget->workspace->membershipFor($user);

        return $membership && in_array($membership->role, ['owner', 'admin', 'member'], true);
    }
}
