<?php

namespace App\Policies;

use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

class TransactionPolicy
{
    /**
     * Determine whether the user can view any transactions in the workspace.
     */
    public function viewAny(User $user, Workspace $workspace): Response
    {
        return $workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /**
     * Determine whether the user can view the specific transaction.
     */
    public function view(User $user, Transaction $transaction): Response
    {
        return $transaction->workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /**
     * Determine whether the user can create transactions in the workspace.
     * Owner, Admin, and Member can create transactions; Viewer cannot.
     */
    public function create(User $user, Workspace $workspace): Response
    {
        $membership = $workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot create transactions.');
    }

    /**
     * Determine whether the user can update the transaction.
     * Owner, Admin, and Member can edit transactions; Viewer cannot.
     */
    public function update(User $user, Transaction $transaction): Response
    {
        $membership = $transaction->workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot edit transactions.');
    }

    /**
     * Determine whether the user can delete the transaction.
     * Owner and Admin can delete any transaction in the workspace.
     * Member can delete only transactions they created.
     * Viewer cannot delete any transaction.
     */
    public function delete(User $user, Transaction $transaction): Response
    {
        $membership = $transaction->workspace->membershipFor($user);
        if (! $membership) {
            return Response::denyAsNotFound();
        }

        if (in_array($membership->role, ['owner', 'admin'], true)) {
            return Response::allow();
        }

        if ($membership->role === 'member' && (int) $transaction->created_by === (int) $user->id) {
            return Response::allow();
        }

        return Response::deny('You do not have permission to delete this transaction.');
    }
}
