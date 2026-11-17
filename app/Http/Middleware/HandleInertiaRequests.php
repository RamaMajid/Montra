<?php

namespace App\Http\Middleware;

use App\Models\WorkspaceMember;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $workspaces = [];
        $activeWorkspace = null;

        if ($user) {
            $memberships = $user->workspaceMemberships()
                ->with('workspace')
                ->whereHas('workspace')
                ->get();

            $workspaces = $memberships->map(function (WorkspaceMember $member): array {
                return [
                    'id' => $member->workspace->id,
                    'name' => $member->workspace->name,
                    'type' => $member->workspace->type,
                    'role' => $member->role,
                ];
            })->values()->all();

            $activeWorkspaceId = $request->session()->get('active_workspace_id');
            /** @var WorkspaceMember|null $activeMember */
            $activeMember = $memberships->first(fn (WorkspaceMember $m): bool => $m->workspace_id === $activeWorkspaceId);

            if ($activeMember) {
                $activeWorkspace = [
                    'id' => $activeMember->workspace->id,
                    'name' => $activeMember->workspace->name,
                    'type' => $activeMember->workspace->type,
                    'role' => $activeMember->role,
                    'owner_id' => $activeMember->workspace->owner_id,
                ];
            }
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
            ],
            'workspaces' => $workspaces,
            'activeWorkspace' => $activeWorkspace,
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'invitation_url' => $request->session()->get('invitation_url'),
        ];
    }
}
