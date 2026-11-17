<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\ManageWorkspace;
use App\Http\Requests\UpdateWorkspaceMemberRequest;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class WorkspaceMemberController extends Controller
{
    public function update(UpdateWorkspaceMemberRequest $request, Workspace $workspace, WorkspaceMember $member, ManageWorkspace $action): RedirectResponse
    {
        Gate::authorize('manageMember', [$workspace, $member]);

        $action->updateMemberRole($request->user(), $workspace, $member, $request->validated('role'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member role updated.')]);

        return back();
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceMember $member, ManageWorkspace $action): RedirectResponse
    {
        Gate::authorize('manageMember', [$workspace, $member]);

        $action->removeMember($request->user(), $workspace, $member);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member removed.')]);

        return back();
    }
}
