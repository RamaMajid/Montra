<?php

namespace App\Actions;

use App\Models\SavingsGoal;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AccountBalanceService;
use App\Services\SavingsGoalService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ManageSavingsGoal
{
    public function __construct(
        protected SavingsGoalService $savingsGoalService,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function save(User $user, Workspace $workspace, array $data, ?SavingsGoal $goal = null): SavingsGoal
    {
        return DB::transaction(function () use ($user, $workspace, $data, $goal): SavingsGoal {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize($goal ? 'update' : 'create', $goal ?? [SavingsGoal::class, $workspace]);

            $targetAmount = AccountBalanceService::parseBigInt($data['target_amount']);

            $payload = [
                'workspace_id' => $workspace->id,
                'name' => (string) $data['name'],
                'description' => isset($data['description']) ? (string) $data['description'] : null,
                'target_amount' => $targetAmount,
                'target_date' => isset($data['target_date']) && $data['target_date'] ? (string) $data['target_date'] : null,
                'created_by' => $goal !== null ? $goal->created_by : $user->id,
            ];

            if ($goal) {
                $goal = $workspace->savingsGoals()->whereKey($goal->id)->lockForUpdate()->firstOrFail();
                $goal->update($payload);
            } else {
                $payload['status'] = 'active';
                $goal = $workspace->savingsGoals()->create($payload);
            }

            $this->savingsGoalService->syncStatus($goal);

            return $goal->fresh(['creator']);
        });
    }

    public function archive(User $user, Workspace $workspace, SavingsGoal $goal): void
    {
        DB::transaction(function () use ($user, $workspace, $goal): void {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $goal = $workspace->savingsGoals()->whereKey($goal->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize('delete', $goal);

            $goal->update(['status' => 'archived']);
        });
    }
}
