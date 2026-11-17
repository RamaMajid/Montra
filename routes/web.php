<?php

use App\Http\Controllers\ActiveWorkspaceController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\WorkspaceInvitationController;
use App\Http\Controllers\WorkspaceMemberController;
use App\Http\Middleware\EnsureActiveWorkspace;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified', EnsureActiveWorkspace::class])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Workspaces
    Route::get('workspaces', [WorkspaceController::class, 'index'])->name('workspaces.index');
    Route::post('workspaces', [WorkspaceController::class, 'store'])->name('workspaces.store');
    Route::get('workspaces/{workspace}', [WorkspaceController::class, 'show'])->name('workspaces.show');
    Route::put('workspaces/{workspace}', [WorkspaceController::class, 'update'])->name('workspaces.update');
    Route::delete('workspaces/{workspace}', [WorkspaceController::class, 'destroy'])->name('workspaces.destroy');
    Route::post('workspaces/{workspace}/members/{member}/transfer-ownership', [WorkspaceController::class, 'transferOwnership'])->name('workspaces.transfer-ownership');

    // Active workspace switch
    Route::post('workspaces/active', ActiveWorkspaceController::class)->name('workspaces.active');

    // Workspace members
    Route::put('workspaces/{workspace}/members/{member}', [WorkspaceMemberController::class, 'update'])->name('workspaces.members.update');
    Route::delete('workspaces/{workspace}/members/{member}', [WorkspaceMemberController::class, 'destroy'])->name('workspaces.members.destroy');

    // Workspace invitations
    Route::post('workspaces/{workspace}/invitations', [WorkspaceInvitationController::class, 'store'])->name('workspaces.invitations.store');
    Route::delete('workspaces/{workspace}/invitations/{invitation}', [WorkspaceInvitationController::class, 'destroy'])->name('workspaces.invitations.destroy');
    Route::get('invitations/{token}/accept', [WorkspaceInvitationController::class, 'show'])->name('invitations.accept');
    Route::post('invitations/{token}/accept', [WorkspaceInvitationController::class, 'accept'])->middleware('throttle:10,1')->name('invitations.confirm');
});

require __DIR__.'/settings.php';
