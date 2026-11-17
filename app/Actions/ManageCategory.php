<?php

namespace App\Actions;

use App\Models\Category;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ManageCategory
{
    /** @param array<string, mixed> $data */
    public function save(User $user, Workspace $workspace, array $data, ?Category $category = null): Category
    {
        try {
            return DB::transaction(function () use ($user, $workspace, $data, $category): Category {
                $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
                Gate::forUser($user)->authorize('update', $workspace);
                if ($category) {
                    $category = $workspace->categories()->whereKey($category->id)->lockForUpdate()->firstOrFail();
                    unset($data['type']);
                    $category->update($data);
                } else {
                    $category = $workspace->categories()->create($data);
                }

                return $category;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['name' => 'A category with this name and type already exists, including archived categories.']);
        }
    }

    public function setActive(User $user, Workspace $workspace, Category $category, bool $active): void
    {
        DB::transaction(function () use ($user, $workspace, $category, $active): void {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize('update', [$category, $workspace]);
            $workspace->categories()->whereKey($category->id)->firstOrFail()->update(['is_active' => $active]);
        });
    }
}
