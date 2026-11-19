<?php

namespace App\Services;

use App\Models\SavingsGoal;
use App\Models\Workspace;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SavingsGoalService
{
    public function __construct(
        protected FinancialAnalyticsService $analyticsService,
    ) {}

    /**
     * Calculate progress details for a single goal.
     *
     * @return array{
     *     target_amount: string,
     *     total_contributions: string,
     *     remaining_amount: string,
     *     progress_percentage: string,
     *     is_completed: bool,
     *     status: string
     * }
     */
    public function calculateProgress(SavingsGoal $goal, ?int $preloadedContributions = null): array
    {
        $target = $goal->target_amount;
        $total = $preloadedContributions ?? AccountBalanceService::parseBigInt(
            $goal->contributions()->sum('amount')
        );

        $remaining = $total >= $target ? 0 : AccountBalanceService::sub($target, $total);
        $isCompleted = $total >= $target;

        $percentage = '0';
        if ($target > 0) {
            $percentage = $this->analyticsService->percentage($total, $target) ?? '0';
        }

        return [
            'target_amount' => (string) $target,
            'total_contributions' => (string) $total,
            'remaining_amount' => (string) $remaining,
            'progress_percentage' => $percentage,
            'is_completed' => $isCompleted,
            'status' => $goal->status,
        ];
    }

    /**
     * Batch-calculate progress for multiple goals avoiding N+1 queries.
     *
     * @param  Collection<int, SavingsGoal>  $goals
     * @return array<int, array<string, mixed>>
     */
    public function calculateMany(Collection $goals): array
    {
        if ($goals->isEmpty()) {
            return [];
        }

        $sums = DB::table('goal_contributions')
            ->selectRaw('savings_goal_id, COALESCE(SUM(amount), 0) as total')
            ->whereIn('savings_goal_id', $goals->pluck('id'))
            ->groupBy('savings_goal_id')
            ->pluck('total', 'savings_goal_id')
            ->all();

        $results = [];
        foreach ($goals as $goal) {
            $total = AccountBalanceService::parseBigInt($sums[$goal->id] ?? 0);
            $results[$goal->id] = $this->calculateProgress($goal, $total);
        }

        return $results;
    }

    /**
     * Sync goal status (active vs completed) based on contributions total.
     * If archived, status remains archived.
     */
    public function syncStatus(SavingsGoal $goal): void
    {
        if ($goal->status === 'archived') {
            return;
        }

        $total = AccountBalanceService::parseBigInt($goal->contributions()->sum('amount'));

        if ($total >= $goal->target_amount && $goal->status !== 'completed') {
            $goal->update(['status' => 'completed']);
        } elseif ($total < $goal->target_amount && $goal->status === 'completed') {
            $goal->update(['status' => 'active']);
        }
    }

    /**
     * Summary metrics for all goals in the workspace.
     *
     * @return array{
     *     total_goals: int,
     *     active_goals: int,
     *     completed_goals: int,
     *     total_target_amount: string,
     *     total_saved_amount: string
     * }
     */
    public function getWorkspaceSummary(Workspace $workspace): array
    {
        $goals = $workspace->savingsGoals()->get();
        $progress = $this->calculateMany($goals);

        $totalTarget = 0;
        $totalSaved = 0;
        $activeCount = 0;
        $completedCount = 0;

        foreach ($goals as $goal) {
            if ($goal->status !== 'archived') {
                $totalTarget = AccountBalanceService::add($totalTarget, $goal->target_amount);
                $saved = AccountBalanceService::parseBigInt($progress[$goal->id]['total_contributions'] ?? 0);
                $totalSaved = AccountBalanceService::add($totalSaved, $saved);

                if ($goal->status === 'completed') {
                    $completedCount++;
                } else {
                    $activeCount++;
                }
            }
        }

        return [
            'total_goals' => $goals->count(),
            'active_goals' => $activeCount,
            'completed_goals' => $completedCount,
            'total_target_amount' => (string) $totalTarget,
            'total_saved_amount' => (string) $totalSaved,
        ];
    }
}
