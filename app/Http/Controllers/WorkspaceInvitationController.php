<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\ManageWorkspace;
use App\Http\Requests\StoreWorkspaceInvitationRequest;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceInvitationController extends Controller
{
    public function store(StoreWorkspaceInvitationRequest $request, Workspace $workspace, ManageWorkspace $action): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        $data = $request->validated();
        [$invitation, $plainToken] = $action->invite($request->user(), $workspace, [
            'email' => (string) $data['email'],
            'role' => (string) $data['role'],
        ]);

        $request->session()->flash('invitation_url', route('invitations.accept', ['token' => $plainToken]));
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation created.')]);

        return back();
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceInvitation $invitation): RedirectResponse
    {
        Gate::authorize('manageMembers', $workspace);

        if ($invitation->workspace_id !== $workspace->id) {
            abort(404);
        }

        DB::transaction(function () use ($workspace, $invitation, $request): void {
            $lockedWorkspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($request->user())->authorize('manageMembers', $lockedWorkspace);
            $lockedInvitation = WorkspaceInvitation::query()->whereKey($invitation->id)->lockForUpdate()->firstOrFail();
            abort_unless($lockedInvitation->workspace_id === $lockedWorkspace->id, 404);
            $lockedInvitation->update(['revoked_at' => now()]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation revoked.')]);

        return back();
    }

    public function show(Request $request, string $token): Response
    {
        $invitation = WorkspaceInvitation::query()->where('token_hash', hash('sha256', $token))->first();
        abort_unless($invitation && ! $invitation->accepted_at && ! $invitation->revoked_at && $invitation->expires_at->isFuture() && mb_strtolower($invitation->email) === mb_strtolower($request->user()->email) && $invitation->workspace, 404);

        return Inertia::render('workspaces/invitation', ['token' => $token, 'workspaceName' => $invitation->workspace->name]);
    }

    public function accept(Request $request, string $token, ManageWorkspace $action): RedirectResponse
    {
        $workspace = $action->acceptInvite($request->user(), $token);

        $request->session()->put('active_workspace_id', $workspace->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Joined workspace successfully.')]);

        return redirect()->route('workspaces.show', $workspace);
    }
}
