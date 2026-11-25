<?php

namespace App\Services\Intelligence\Rules;

use App\Models\SavingsGoal;
use App\Models\Workspace;
use App\Services\Intelligence\Contracts\InsightRule;
use App\Services\SavingsGoalService;
use Illuminate\Support\Carbon;

class SavingsProgressRule implements InsightRule
{
    public function __construct(
        protected SavingsGoalService $savingsGoalService,
    ) {}

    public function key(): string
    {
        return 'savings_progress';
    }

    public function name(): string
    {
        return 'Progres Target Tabungan';
    }

    public function category(): string
    {
        return 'savings_progress';
    }

    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $goals = SavingsGoal::query()
            ->where('workspace_id', $workspace->id)
            ->notArchived()
            ->get();

        if ($goals->isEmpty()) {
            return [];
        }

        $progressList = $this->savingsGoalService->calculateMany($goals);
        $insights = [];

        foreach ($goals as $goal) {
            $progress = $progressList[$goal->id] ?? null;
            if (! $progress) {
                continue;
            }

            $percentage = (float) ($progress['progress_percentage'] ?? 0);
            $isCompleted = (bool) ($progress['is_completed'] ?? false);

            if ($isCompleted || $percentage >= 100) {
                $ruleKey = 'savings_goal_completed';
                $title = "Target Tabungan Tercapai: {$goal->name}";
                $description = "Selamat! Target tabungan {$goal->name} telah tercapai 100% sebesar ".$this->formatRupiah((string) $goal->target_amount).'.';
                $fingerprint = hash('sha256', "{$workspace->id}:savings_goal_completed:{$goal->id}");

                $insights[] = [
                    'rule_key' => $ruleKey,
                    'title' => $title,
                    'description' => $description,
                    'severity' => 'info',
                    'period_start' => null,
                    'period_end' => null,
                    'supporting_data' => [
                        'savings_goal_id' => $goal->id,
                        'name' => $goal->name,
                        'target_amount' => (string) $goal->target_amount,
                        'total_contributions' => (string) $progress['total_contributions'],
                        'progress_percentage' => (string) $progress['progress_percentage'],
                    ],
                    'fingerprint' => $fingerprint,
                ];

                continue;
            }

            if ($percentage >= 80) {
                $ruleKey = 'savings_milestone_80';
                $title = "Target Tabungan Mendekati Selesai: {$goal->name}";
                $description = "Progres tabungan {$goal->name} telah mencapai {$progress['progress_percentage']}%, mendekati target akhir.";
                $fingerprint = hash('sha256', "{$workspace->id}:savings_milestone_80:{$goal->id}");

                $insights[] = [
                    'rule_key' => $ruleKey,
                    'title' => $title,
                    'description' => $description,
                    'severity' => 'info',
                    'period_start' => null,
                    'period_end' => null,
                    'supporting_data' => [
                        'savings_goal_id' => $goal->id,
                        'name' => $goal->name,
                        'target_amount' => (string) $goal->target_amount,
                        'total_contributions' => (string) $progress['total_contributions'],
                        'progress_percentage' => (string) $progress['progress_percentage'],
                    ],
                    'fingerprint' => $fingerprint,
                ];

                continue;
            }

            if ($percentage >= 50) {
                $ruleKey = 'savings_milestone_50';
                $title = "Target Tabungan Mencapai 50%: {$goal->name}";
                $description = "Progres tabungan {$goal->name} telah mencapai separuh perjalanan ({$progress['progress_percentage']}%).";
                $fingerprint = hash('sha256', "{$workspace->id}:savings_milestone_50:{$goal->id}");

                $insights[] = [
                    'rule_key' => $ruleKey,
                    'title' => $title,
                    'description' => $description,
                    'severity' => 'info',
                    'period_start' => null,
                    'period_end' => null,
                    'supporting_data' => [
                        'savings_goal_id' => $goal->id,
                        'name' => $goal->name,
                        'target_amount' => (string) $goal->target_amount,
                        'total_contributions' => (string) $progress['total_contributions'],
                        'progress_percentage' => (string) $progress['progress_percentage'],
                    ],
                    'fingerprint' => $fingerprint,
                ];
            }
        }

        return $insights;
    }

    private function formatRupiah(string $amount): string
    {
        return 'Rp '.(preg_replace('/\B(?=(\d{3})+(?!\d))/', '.', $amount) ?? $amount);
    }
}
