<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\ActiveWorkspaceController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GoalContributionController;
use App\Http\Controllers\ImportBatchController;
use App\Http\Controllers\IntelligenceController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SavingsGoalController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\WorkspaceController;
use App\Http\Controllers\WorkspaceInvitationController;
use App\Http\Controllers\WorkspaceMemberController;
use App\Http\Middleware\EnsureActiveWorkspace;
use App\Services\ReportService;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified', EnsureActiveWorkspace::class])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::get('analytics', AnalyticsController::class)->name('analytics');
    Route::get('analytics/page', [AnalyticsController::class, 'page'])->name('analytics.page');

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

    // Accounts
    Route::get('accounts', [AccountController::class, 'index'])->name('accounts.index');
    Route::post('accounts', [AccountController::class, 'store'])->name('accounts.store');
    Route::put('accounts/{account}', [AccountController::class, 'update'])->name('accounts.update');
    Route::post('accounts/{account}/archive', [AccountController::class, 'archive'])->name('accounts.archive');
    Route::post('accounts/{account}/restore', [AccountController::class, 'restore'])->name('accounts.restore');

    // Categories
    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::put('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::post('categories/{category}/archive', [CategoryController::class, 'archive'])->name('categories.archive');
    Route::post('categories/{category}/restore', [CategoryController::class, 'restore'])->name('categories.restore');

    // Budgets
    Route::get('budgets', [BudgetController::class, 'index'])->name('budgets.index');
    Route::post('budgets', [BudgetController::class, 'store'])->name('budgets.store');
    Route::put('budgets/{budget}', [BudgetController::class, 'update'])->name('budgets.update');
    Route::post('budgets/{budget}/archive', [BudgetController::class, 'archive'])->name('budgets.archive');

    // Imports
    Route::get('imports', [ImportBatchController::class, 'index'])->name('imports.index');
    Route::post('imports', [ImportBatchController::class, 'store'])->name('imports.store');
    Route::get('imports/{importBatch}', [ImportBatchController::class, 'show'])->name('imports.show');
    Route::put('imports/{importBatch}/preview', [ImportBatchController::class, 'preview'])->name('imports.preview');
    Route::post('imports/{importBatch}/confirm', [ImportBatchController::class, 'confirm'])->name('imports.confirm');

    // Transactions
    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('transactions', [TransactionController::class, 'store'])->name('transactions.store');
    Route::put('transactions/{transaction}', [TransactionController::class, 'update'])->name('transactions.update');
    Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy'])->name('transactions.destroy');

    // Savings Goals
    Route::get('savings-goals', [SavingsGoalController::class, 'index'])->name('savings-goals.index');
    Route::post('savings-goals', [SavingsGoalController::class, 'store'])->name('savings-goals.store');
    Route::get('savings-goals/{savings_goal}', [SavingsGoalController::class, 'show'])->name('savings-goals.show');
    Route::put('savings-goals/{savings_goal}', [SavingsGoalController::class, 'update'])->name('savings-goals.update');
    Route::post('savings-goals/{savings_goal}/archive', [SavingsGoalController::class, 'archive'])->name('savings-goals.archive');

    // Goal Contributions
    Route::post('savings-goals/{savings_goal}/contributions', [GoalContributionController::class, 'store'])->name('savings-goals.contributions.store');
    Route::put('savings-goals/{savings_goal}/contributions/{contribution}', [GoalContributionController::class, 'update'])->name('savings-goals.contributions.update');
    Route::delete('savings-goals/{savings_goal}/contributions/{contribution}', [GoalContributionController::class, 'destroy'])->name('savings-goals.contributions.destroy');

    // Reports
    Route::get('reports/{type}', [ReportController::class, 'show'])->whereIn('type', ReportService::TYPES)->name('reports.show');
    Route::get('reports/{type}/export', [ReportController::class, 'export'])->whereIn('type', ReportService::TYPES)->middleware('throttle:20,1')->name('reports.export');

    // Intelligence
    Route::get('intelligence', [IntelligenceController::class, 'index'])->name('intelligence.index');
    Route::patch('intelligence/{insight}/read', [IntelligenceController::class, 'markAsRead'])->name('intelligence.read');
    Route::post('intelligence/read-all', [IntelligenceController::class, 'markAllAsRead'])->name('intelligence.read-all');
});

require __DIR__.'/settings.php';
