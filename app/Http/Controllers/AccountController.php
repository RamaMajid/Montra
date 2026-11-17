<?php

namespace App\Http\Controllers;

use App\Actions\ManageAccount;
use App\Http\Requests\AccountRequest;
use App\Models\Account;
use App\Models\Workspace;
use App\Services\AccountBalanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request, AccountBalanceService $balanceService): Response
    {
        $workspace = $this->activeWorkspace($request);
        $balances = $balanceService->getBalancesForWorkspace($workspace);
        $accounts = $workspace->accounts()
            ->orderBy('is_active', 'desc')
            ->orderBy('name')
            ->get()
            ->map(fn (Account $acc): array => [
                'id' => $acc->id,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'initial_balance' => (string) $acc->initial_balance,
                'current_balance' => (string) ($balances[$acc->id] ?? $acc->initial_balance),
                'institution' => $acc->institution,
                'description' => $acc->description,
                'color' => $acc->color,
                'icon' => $acc->icon,
                'is_active' => $acc->is_active,
            ])
            ->all();

        return Inertia::render('accounts/index', [
            'accounts' => $accounts,
            'canManage' => Gate::allows('update', $workspace),
        ]);
    }

    public function store(AccountRequest $request, ManageAccount $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->save($request->user(), $workspace, $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account created.')]);

        return back();
    }

    public function update(AccountRequest $request, Account $account, ManageAccount $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->save($request->user(), $workspace, $request->validated(), $account);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account updated.')]);

        return back();
    }

    public function archive(Request $request, Account $account, ManageAccount $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->setActive($request->user(), $workspace, $account, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account archived.')]);

        return back();
    }

    public function restore(Request $request, Account $account, ManageAccount $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->setActive($request->user(), $workspace, $account, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Account restored.')]);

        return back();
    }
}
