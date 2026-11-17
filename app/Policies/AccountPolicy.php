<?php

namespace App\Policies;

use App\Models\Account;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;

class AccountPolicy
{
    public function view(User $user, Account $account, Workspace $workspace): Response
    {
        if ($account->workspace_id !== $workspace->id) {
            return Response::denyAsNotFound();
        }

        return Gate::forUser($user)->inspect('view', $workspace);
    }

    public function update(User $user, Account $account, Workspace $workspace): Response
    {
        if ($account->workspace_id !== $workspace->id) {
            return Response::denyAsNotFound();
        }

        return Gate::forUser($user)->inspect('update', $workspace);
    }
}
