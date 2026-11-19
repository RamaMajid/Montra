<?php

namespace App\Http\Controllers;

use App\Actions\ManageBudget;
use App\Http\Requests\BudgetRequest;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Workspace;
use App\Services\BudgetProgressService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $request->session()->get('active_workspace_id'));
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request, BudgetProgressService $progressService): Response
    {
        $workspace = $this->activeWorkspace($request);
        $budgets = $workspace->budgets()
            ->with(['budgetCategories.category', 'creator'])
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Budget $budget): array => $this->budgetData($budget, $progressService, Gate::allows('delete', $budget)))
            ->all();
        $categories = $workspace->categories()
            ->where('type', 'expense')
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category): array => ['id' => $category->id, 'name' => $category->name])
            ->all();

        return Inertia::render('budgets/index', [
            'budgets' => $budgets,
            'categories' => $categories,
            'canManage' => Gate::allows('create', [Budget::class, $workspace]),
        ]);
    }

    public function store(BudgetRequest $request, ManageBudget $action): RedirectResponse
    {
        $action->save($request->user(), $this->activeWorkspace($request), $request->validated());
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Budget created.')]);

        return back();
    }

    public function update(BudgetRequest $request, Budget $budget, ManageBudget $action): RedirectResponse
    {
        $action->save($request->user(), $this->activeWorkspace($request), $request->validated(), $budget);
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Budget updated.')]);

        return back();
    }

    public function archive(Request $request, Budget $budget, ManageBudget $action): RedirectResponse
    {
        $action->archive($request->user(), $this->activeWorkspace($request), $budget);
        Inertia::flash('toast', ['type' => 'success', 'message' => __('Budget archived.')]);

        return back();
    }

    /** @return array<string, mixed> */
    private function budgetData(Budget $budget, BudgetProgressService $progressService, bool $canArchive): array
    {
        return [
            'id' => $budget->id,
            'name' => $budget->name,
            'period_start' => $budget->period_start->format('Y-m-d'),
            'period_end' => $budget->period_end->format('Y-m-d'),
            'total_amount' => (string) $budget->total_amount,
            'status' => $budget->status,
            'created_by' => $budget->created_by,
            'creator_name' => $budget->creator->name,
            'can_archive' => $canArchive,
            'progress' => $progressService->calculate($budget),
        ];
    }
}
