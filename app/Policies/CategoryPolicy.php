<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;

class CategoryPolicy
{
    public function view(User $user, Category $category, Workspace $workspace): Response
    {
        if ($category->workspace_id !== $workspace->id) {
            return Response::denyAsNotFound();
        }

        return Gate::forUser($user)->inspect('view', $workspace);
    }

    public function update(User $user, Category $category, Workspace $workspace): Response
    {
        if ($category->workspace_id !== $workspace->id) {
            return Response::denyAsNotFound();
        }

        return Gate::forUser($user)->inspect('update', $workspace);
    }
}
