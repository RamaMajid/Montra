<?php

namespace App\Http\Controllers;

use App\Actions\ManageSavingsGoal;
use App\Http\Requests\SavingsGoalRequest;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Workspace;
use App\Services\SavingsGoalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Response;

class SavingsGoalController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        $statusFilter = $request->query('status');

        $query = $workspace->savingsGoals()->with('creator:id,name');

        if ($statusFilter && in_array($statusFilter, ['active', 'completed', 'archived'], true)) {
            $query->where('status', $statusFilter);
        }

        $goals = $query->orderBy('status')
            ->orderBy('target_date')
            ->orderBy('id')
            ->get();

        $progressList = $service->calculateMany($goals);
        $summary = $service->getWorkspaceSummary($workspace);

        $data = $goals->map(fn (SavingsGoal $goal): array => [
            'id' => $goal->id,
            'name' => $goal->name,
            'description' => $goal->description,
            'target_amount' => (string) $goal->target_amount,
            'target_date' => $goal->target_date ? $goal->target_date->format('Y-m-d') : null,
            'status' => $goal->status,
            'created_by' => $goal->created_by,
            'creator_name' => $goal->creator->name,
            'can_edit' => Gate::allows('update', $goal),
            'can_archive' => Gate::allows('delete', $goal),
            'progress' => $progressList[$goal->id] ?? null,
        ])->all();

        return Response::json([
            'summary' => $summary,
            'goals' => $data,
            'can_create' => Gate::allows('create', [SavingsGoal::class, $workspace]),
        ]);
    }

    public function store(SavingsGoalRequest $request, ManageSavingsGoal $action, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        $goal = $action->save($request->user(), $workspace, $request->validated());
        $progress = $service->calculateProgress($goal);

        return Response::json([
            'message' => 'Savings goal created.',
            'goal' => [
                'id' => $goal->id,
                'name' => $goal->name,
                'description' => $goal->description,
                'target_amount' => (string) $goal->target_amount,
                'target_date' => $goal->target_date ? $goal->target_date->format('Y-m-d') : null,
                'status' => $goal->status,
                'created_by' => $goal->created_by,
                'creator_name' => $goal->creator->name,
                'can_edit' => true,
                'can_archive' => Gate::allows('delete', $goal),
                'progress' => $progress,
            ],
        ], 201);
    }

    public function show(Request $request, SavingsGoal $savingsGoal, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        Gate::authorize('view', $savingsGoal);

        $savingsGoal->load(['creator:id,name', 'contributions.creator:id,name']);
        $progress = $service->calculateProgress($savingsGoal);

        $contributions = $savingsGoal->contributions()
            ->with('creator:id,name')
            ->orderByDesc('contribution_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($c): array => [
                'id' => $c->id,
                'amount' => (string) $c->amount,
                'contribution_date' => $c->contribution_date->format('Y-m-d'),
                'notes' => $c->notes,
                'created_by' => $c->created_by,
                'creator_name' => $c->creator->name,
                'can_edit' => Gate::allows('update', $c),
                'can_delete' => Gate::allows('delete', $c),
            ])->all();

        return Response::json([
            'goal' => [
                'id' => $savingsGoal->id,
                'name' => $savingsGoal->name,
                'description' => $savingsGoal->description,
                'target_amount' => (string) $savingsGoal->target_amount,
                'target_date' => $savingsGoal->target_date ? $savingsGoal->target_date->format('Y-m-d') : null,
                'status' => $savingsGoal->status,
                'created_by' => $savingsGoal->created_by,
                'creator_name' => $savingsGoal->creator->name,
                'can_edit' => Gate::allows('update', $savingsGoal),
                'can_archive' => Gate::allows('delete', $savingsGoal),
                'progress' => $progress,
            ],
            'contributions' => $contributions,
            'can_contribute' => Gate::allows('create', [GoalContribution::class, $savingsGoal]),
        ]);
    }

    public function update(SavingsGoalRequest $request, SavingsGoal $savingsGoal, ManageSavingsGoal $action, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $goal = $action->save($request->user(), $workspace, $request->validated(), $savingsGoal);
        $progress = $service->calculateProgress($goal);

        return Response::json([
            'message' => 'Savings goal updated.',
            'goal' => [
                'id' => $goal->id,
                'name' => $goal->name,
                'description' => $goal->description,
                'target_amount' => (string) $goal->target_amount,
                'target_date' => $goal->target_date ? $goal->target_date->format('Y-m-d') : null,
                'status' => $goal->status,
                'created_by' => $goal->created_by,
                'creator_name' => $goal->creator->name,
                'can_edit' => Gate::allows('update', $goal),
                'can_archive' => Gate::allows('delete', $goal),
                'progress' => $progress,
            ],
        ]);
    }

    public function archive(Request $request, SavingsGoal $savingsGoal, ManageSavingsGoal $action): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $action->archive($request->user(), $workspace, $savingsGoal);

        return Response::json([
            'message' => 'Savings goal archived.',
        ]);
    }
}
