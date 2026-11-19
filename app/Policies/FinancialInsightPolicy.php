<?php

namespace App\Policies;

use App\Models\FinancialInsight;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

class FinancialInsightPolicy
{
    public function viewAny(User $user, Workspace $workspace): Response
    {
        return $workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function view(User $user, FinancialInsight $financialInsight): Response
    {
        return $financialInsight->workspace->membershipFor($user) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function update(User $user, FinancialInsight $financialInsight): Response
    {
        $membership = $financialInsight->workspace->membershipFor($user);

        if (! $membership) {
            return Response::denyAsNotFound();
        }

        return in_array($membership->role, ['owner', 'admin', 'member'], true)
            ? Response::allow()
            : Response::deny('Viewers cannot update insight read status.');
    }
}
