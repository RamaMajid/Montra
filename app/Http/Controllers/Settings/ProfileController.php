<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $ownedWorkspaces = Workspace::withTrashed()->where('owner_id', $user->id)->orderBy('id')->lockForUpdate()->get();

            $hasMultiMemberWorkspace = $ownedWorkspaces->contains(fn (Workspace $workspace): bool => $workspace->type === 'family' && $workspace->members()->where('user_id', '!=', $user->id)->exists()
            );

            if ($hasMultiMemberWorkspace) {
                throw ValidationException::withMessages([
                    'password' => 'Cannot delete account while owning a family workspace with active members. Please transfer ownership first.',
                ]);
            }

            foreach ($ownedWorkspaces as $workspace) {
                $workspace->forceDelete();
            }

            WorkspaceInvitation::where('invited_by', $user->id)->delete();
            $user->workspaceMemberships()->delete();
            $user->delete();
        });

        // Normal logout saves a rotated remember token, recreating the deleted model.
        Auth::guard('web')->logoutCurrentDevice();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
