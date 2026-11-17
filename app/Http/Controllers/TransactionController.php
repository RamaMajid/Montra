<?php

namespace App\Http\Controllers;

use App\Actions\ManageTransaction;
use App\Http\Requests\TransactionRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request): Response
    {
        $workspace = $this->activeWorkspace($request);

        $query = $workspace->transactions()
            ->with([
                'account:id,name,type,color,icon,is_active',
                'sourceAccount:id,name,type,color,icon,is_active',
                'destinationAccount:id,name,type,color,icon,is_active',
                'category:id,name,type,color,icon,is_active',
                'creator:id,name',
            ]);

        if ($request->filled('type') && in_array($request->query('type'), ['income', 'expense', 'transfer'], true)) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('account_id')) {
            $accId = (int) $request->query('account_id');
            $query->where(function ($q) use ($accId): void {
                $q->where('account_id', $accId)
                    ->orWhere('source_account_id', $accId)
                    ->orWhere('destination_account_id', $accId);
            });
        }

        if ($request->filled('category_id')) {
            $catId = (int) $request->query('category_id');
            $query->where('category_id', $catId);
        }

        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->query('date_to'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $query->where(function ($q) use ($search): void {
                $q->whereRaw('lower(description) like ?', ['%'.strtolower($search).'%'])
                    ->orWhereRaw('lower(notes) like ?', ['%'.strtolower($search).'%']);
            });
        }

        $sort = $request->query('sort', 'date_desc');
        match ($sort) {
            'date_asc' => $query->orderBy('transaction_date', 'asc')->orderBy('id', 'asc'),
            'amount_desc' => $query->orderBy('amount', 'desc')->orderBy('transaction_date', 'desc'),
            'amount_asc' => $query->orderBy('amount', 'asc')->orderBy('transaction_date', 'desc'),
            default => $query->orderBy('transaction_date', 'desc')->orderBy('id', 'desc'),
        };

        $transactions = $query->paginate(15)->withQueryString();

        $transactions->through(fn (Transaction $t): array => [
            'id' => $t->id,
            'type' => $t->type,
            'description' => $t->description,
            'amount' => (string) $t->amount,
            'transaction_date' => $t->transaction_date->format('Y-m-d'),
            'notes' => $t->notes,
            'source' => $t->source,
            'created_by' => $t->created_by,
            'creator_name' => $t->creator?->name,
            'account' => $t->account ? [
                'id' => $t->account->id,
                'name' => $t->account->name,
                'type' => $t->account->type->value,
                'color' => $t->account->color,
                'icon' => $t->account->icon,
                'is_active' => $t->account->is_active,
            ] : null,
            'source_account' => $t->sourceAccount ? [
                'id' => $t->sourceAccount->id,
                'name' => $t->sourceAccount->name,
                'type' => $t->sourceAccount->type->value,
                'color' => $t->sourceAccount->color,
                'icon' => $t->sourceAccount->icon,
                'is_active' => $t->sourceAccount->is_active,
            ] : null,
            'destination_account' => $t->destinationAccount ? [
                'id' => $t->destinationAccount->id,
                'name' => $t->destinationAccount->name,
                'type' => $t->destinationAccount->type->value,
                'color' => $t->destinationAccount->color,
                'icon' => $t->destinationAccount->icon,
                'is_active' => $t->destinationAccount->is_active,
            ] : null,
            'category' => $t->category ? [
                'id' => $t->category->id,
                'name' => $t->category->name,
                'type' => $t->category->type->value,
                'color' => $t->category->color,
                'icon' => $t->category->icon,
                'is_active' => $t->category->is_active,
            ] : null,
            'can_edit' => Gate::allows('update', $t),
            'can_delete' => Gate::allows('delete', $t),
        ]);

        $accounts = $workspace->accounts()
            ->orderBy('is_active', 'desc')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'color', 'icon', 'is_active'])
            ->map(fn (Account $acc): array => [
                'id' => $acc->id,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'color' => $acc->color,
                'icon' => $acc->icon,
                'is_active' => $acc->is_active,
            ])
            ->all();

        $categories = $workspace->categories()
            ->orderBy('type')
            ->orderBy('is_active', 'desc')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'color', 'icon', 'is_active'])
            ->map(fn (Category $cat): array => [
                'id' => $cat->id,
                'name' => $cat->name,
                'type' => $cat->type->value,
                'color' => $cat->color,
                'icon' => $cat->icon,
                'is_active' => $cat->is_active,
            ])
            ->all();

        return Inertia::render('transactions/index', [
            'transactions' => $transactions,
            'accounts' => $accounts,
            'categories' => $categories,
            'filters' => [
                'type' => $request->query('type', ''),
                'account_id' => $request->query('account_id', ''),
                'category_id' => $request->query('category_id', ''),
                'date_from' => $request->query('date_from', ''),
                'date_to' => $request->query('date_to', ''),
                'search' => $request->query('search', ''),
                'sort' => $sort,
            ],
            'canCreate' => Gate::allows('create', [Transaction::class, $workspace]),
        ]);
    }

    public function store(TransactionRequest $request, ManageTransaction $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->save($request->user(), $workspace, $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction recorded.')]);

        return back();
    }

    public function update(TransactionRequest $request, Transaction $transaction, ManageTransaction $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $transaction->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $action->save($request->user(), $workspace, $request->validated(), $transaction);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction updated.')]);

        return back();
    }

    public function destroy(Request $request, Transaction $transaction, ManageTransaction $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $transaction->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        Gate::authorize('delete', $transaction);

        $action->delete($transaction);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Transaction deleted.')]);

        return back();
    }
}
