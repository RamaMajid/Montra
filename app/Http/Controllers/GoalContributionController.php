<?php

namespace App\Http\Controllers;

use App\Actions\ManageGoalContribution;
use App\Http\Requests\GoalContributionRequest;
use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Workspace;
use App\Services\SavingsGoalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Response;

class GoalContributionController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function store(GoalContributionRequest $request, SavingsGoal $savingsGoal, ManageGoalContribution $action, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $contribution = $action->create($request->user(), $savingsGoal, $request->validated());
        $progress = $service->calculateProgress($savingsGoal->fresh());

        return Response::json([
            'message' => 'Contribution recorded.',
            'contribution' => [
                'id' => $contribution->id,
                'amount' => (string) $contribution->amount,
                'contribution_date' => $contribution->contribution_date->format('Y-m-d'),
                'notes' => $contribution->notes,
                'created_by' => $contribution->created_by,
                'creator_name' => $contribution->creator->name,
                'can_edit' => true,
                'can_delete' => Gate::allows('delete', $contribution),
            ],
            'goal_progress' => $progress,
        ], 201);
    }

    public function update(GoalContributionRequest $request, SavingsGoal $savingsGoal, GoalContribution $contribution, ManageGoalContribution $action, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id || (int) $contribution->savings_goal_id !== (int) $savingsGoal->id) {
            abort(404);
        }

        $contribution = $action->update($request->user(), $contribution, $request->validated());
        $progress = $service->calculateProgress($savingsGoal->fresh());

        return Response::json([
            'message' => 'Contribution updated.',
            'contribution' => [
                'id' => $contribution->id,
                'amount' => (string) $contribution->amount,
                'contribution_date' => $contribution->contribution_date->format('Y-m-d'),
                'notes' => $contribution->notes,
                'created_by' => $contribution->created_by,
                'creator_name' => $contribution->creator->name,
                'can_edit' => Gate::allows('update', $contribution),
                'can_delete' => Gate::allows('delete', $contribution),
            ],
            'goal_progress' => $progress,
        ]);
    }

    public function destroy(Request $request, SavingsGoal $savingsGoal, GoalContribution $contribution, ManageGoalContribution $action, SavingsGoalService $service): JsonResponse
    {
        $workspace = $this->activeWorkspace($request);
        if ((int) $savingsGoal->workspace_id !== (int) $workspace->id || (int) $contribution->savings_goal_id !== (int) $savingsGoal->id) {
            abort(404);
        }

        $action->delete($request->user(), $contribution);
        $progress = $service->calculateProgress($savingsGoal->fresh());

        return Response::json([
            'message' => 'Contribution deleted.',
            'goal_progress' => $progress,
        ]);
    }
}
