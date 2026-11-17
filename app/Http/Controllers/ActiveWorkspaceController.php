<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ActiveWorkspaceController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'workspace_id' => ['required', 'integer', 'exists:workspaces,id'],
        ]);

        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $validated['workspace_id']);

        if (! $workspace->membershipFor($request->user())) {
            abort(404);
        }

        $request->session()->put('active_workspace_id', $workspace->id);

        return back();
    }
}
