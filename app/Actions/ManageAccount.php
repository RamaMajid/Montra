<?php

namespace App\Actions;

use App\Models\Account;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ManageAccount
{
    /** @param array<string, mixed> $data */
    public function save(User $user, Workspace $workspace, array $data, ?Account $account = null): Account
    {
        try {
            return DB::transaction(function () use ($user, $workspace, $data, $account): Account {
                $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
                Gate::forUser($user)->authorize('update', $workspace);
                if ($account) {
                    $account = $workspace->accounts()->whereKey($account->id)->lockForUpdate()->firstOrFail();
                    $account->update($data);
                } else {
                    $account = $workspace->accounts()->create($data);
                }

                return $account;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'An account with this name already exists, including archived accounts.']);
        }
    }

    public function setActive(User $user, Workspace $workspace, Account $account, bool $active): void
    {
        DB::transaction(function () use ($user, $workspace, $account, $active): void {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize('update', [$account, $workspace]);
            $workspace->accounts()->whereKey($account->id)->firstOrFail()->update(['is_active' => $active]);
        });
    }
}
