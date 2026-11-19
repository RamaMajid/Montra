<?php

namespace App\Actions;

use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Services\AccountBalanceService;
use App\Services\SavingsGoalService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ManageGoalContribution
{
    public function __construct(
        protected SavingsGoalService $savingsGoalService,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $user, SavingsGoal $goal, array $data): GoalContribution
    {
        return DB::transaction(function () use ($user, $goal, $data): GoalContribution {
            $goal = SavingsGoal::query()->whereKey($goal->id)->lockForUpdate()->firstOrFail();

            if ($goal->status === 'archived') {
                throw ValidationException::withMessages([
                    'savings_goal' => 'Cannot record contributions to an archived savings goal.',
                ]);
            }

            Gate::forUser($user)->authorize('create', [GoalContribution::class, $goal]);

            $amount = AccountBalanceService::parseBigInt($data['amount']);

            $contribution = $goal->contributions()->create([
                'amount' => $amount,
                'contribution_date' => (string) $data['contribution_date'],
                'notes' => isset($data['notes']) ? (string) $data['notes'] : null,
                'created_by' => $user->id,
            ]);

            $this->savingsGoalService->syncStatus($goal);

            return $contribution->fresh(['creator', 'savingsGoal']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $user, GoalContribution $contribution, array $data): GoalContribution
    {
        return DB::transaction(function () use ($user, $contribution, $data): GoalContribution {
            $contribution = GoalContribution::query()->whereKey($contribution->id)->lockForUpdate()->firstOrFail();
            $goal = SavingsGoal::query()->whereKey($contribution->savings_goal_id)->lockForUpdate()->firstOrFail();

            if ($goal->status === 'archived') {
                throw ValidationException::withMessages([
                    'savings_goal' => 'Cannot modify contributions of an archived savings goal.',
                ]);
            }

            Gate::forUser($user)->authorize('update', $contribution);

            $amount = AccountBalanceService::parseBigInt($data['amount']);

            $contribution->update([
                'amount' => $amount,
                'contribution_date' => (string) $data['contribution_date'],
                'notes' => isset($data['notes']) ? (string) $data['notes'] : null,
            ]);

            $this->savingsGoalService->syncStatus($goal);

            return $contribution->fresh(['creator', 'savingsGoal']);
        });
    }

    public function delete(User $user, GoalContribution $contribution): void
    {
        DB::transaction(function () use ($user, $contribution): void {
            $contribution = GoalContribution::query()->whereKey($contribution->id)->lockForUpdate()->firstOrFail();
            $goal = SavingsGoal::query()->whereKey($contribution->savings_goal_id)->lockForUpdate()->firstOrFail();

            Gate::forUser($user)->authorize('delete', $contribution);

            $contribution->delete();

            $this->savingsGoalService->syncStatus($goal);
        });
    }
}
