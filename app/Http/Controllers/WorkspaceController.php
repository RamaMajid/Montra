<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\ManageWorkspace;
use App\Http\Requests\StoreWorkspaceRequest;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $memberships = $user->workspaceMemberships()->with('workspace')->whereHas('workspace')->get();

        $workspaces = $memberships->map(function (WorkspaceMember $member): array {
            return [
                'id' => $member->workspace->id,
                'name' => $member->workspace->name,
                'type' => $member->workspace->type,
                'description' => $member->workspace->description,
                'role' => $member->role,
            ];
        })->values()->all();

        return Inertia::render('workspaces/index', [
            'workspaces' => $workspaces,
        ]);
    }

    public function store(StoreWorkspaceRequest $request, ManageWorkspace $action): RedirectResponse
    {
        $data = $request->validated();
        $workspace = $action->createFamily($request->user(), [
            'name' => (string) $data['name'],
            'description' => isset($data['description']) ? (string) $data['description'] : null,
        ]);
        $request->session()->put('active_workspace_id', $workspace->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Workspace created.')]);

        return redirect()->route('workspaces.show', $workspace);
    }

    public function show(Request $request, Workspace $workspace): Response
    {
        Gate::authorize('view', $workspace);

        $workspace->load([
            'members' => fn ($q) => $q->select(['id', 'workspace_id', 'user_id', 'role', 'joined_at']),
            'members.user' => fn ($q) => $q->select(['id', 'name', 'email']),
        ]);

        $membership = $workspace->membershipFor($request->user());

        $members = $workspace->members->map(fn (WorkspaceMember $m): array => [
            'id' => $m->id,
            'user_id' => $m->user_id,
            'role' => $m->role,
            'user' => [
                'id' => $m->user->id,
                'name' => $m->user->name,
                'email' => $m->user->email,
            ],
        ])->values()->all();

        $workspaceData = [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'type' => $workspace->type,
            'description' => $workspace->description,
            'members' => $members,
        ];

        return Inertia::render('workspaces/show', [
            'workspace' => $workspaceData,
            'membership' => [
                'user_id' => $membership->user_id,
                'role' => $membership->role,
            ],
            'invitations' => Gate::allows('manageMembers', $workspace)
                ? $workspace->invitations()
                    ->whereNull('accepted_at')
                    ->whereNull('revoked_at')
                    ->get(['id', 'email', 'role', 'expires_at'])
                    ->map(fn ($inv): array => [
                        'id' => $inv->id,
                        'email' => $inv->email,
                        'role' => $inv->role,
                        'expires_at' => $inv->expires_at->toISOString(),
                    ])
                    ->values()
                    ->all()
                : [],
            'can' => [
                'update' => Gate::allows('update', $workspace),
                'manageMembers' => Gate::allows('manageMembers', $workspace),
                'transferOwnership' => Gate::allows('transferOwnership', $workspace),
                'delete' => Gate::allows('delete', $workspace),
            ],
        ]);
    }

    public function update(StoreWorkspaceRequest $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        DB::transaction(function () use ($workspace, $request): void {
            /** @var Workspace $lockedWorkspace */
            $lockedWorkspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($request->user())->authorize('update', $lockedWorkspace);

            $data = $request->validated();
            $lockedWorkspace->update([
                'name' => (string) $data['name'],
                'description' => isset($data['description']) ? (string) $data['description'] : null,
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Workspace updated.')]);

        return back();
    }

    public function destroy(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('delete', $workspace);

        DB::transaction(function () use ($workspace, $request): void {
            /** @var Workspace $lockedWorkspace */
            $lockedWorkspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($request->user())->authorize('delete', $lockedWorkspace);

            $lockedWorkspace->invitations()->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            $lockedWorkspace->delete();
        });

        /** @var Workspace|null $personal */
        $personal = $request->user()->ownedWorkspaces()->where('type', 'personal')->first();
        if ($personal) {
            $request->session()->put('active_workspace_id', $personal->id);
        } else {
            $request->session()->forget('active_workspace_id');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Workspace deleted.')]);

        return redirect()->route('dashboard');
    }

    public function transferOwnership(Request $request, Workspace $workspace, WorkspaceMember $member, ManageWorkspace $action): RedirectResponse
    {
        Gate::authorize('transferOwnership', $workspace);

        $action->transferOwnership($request->user(), $workspace, $member);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Ownership transferred.')]);

        return back();
    }
}
