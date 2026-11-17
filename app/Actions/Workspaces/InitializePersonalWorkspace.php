<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

class InitializePersonalWorkspace
{
    public function for(User $user): Workspace
    {
        return DB::transaction(function () use ($user): Workspace {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $workspace = Workspace::query()->firstOrCreate(
                ['owner_id' => $user->id, 'type' => 'personal'],
                ['name' => $user->name.'’s personal workspace'],
            );
            $workspace->members()->firstOrCreate(['user_id' => $user->id], ['role' => 'owner', 'joined_at' => now()]);
            app(InitializeDefaultCategories::class)->for($workspace);

            return $workspace;
        });
    }
}
