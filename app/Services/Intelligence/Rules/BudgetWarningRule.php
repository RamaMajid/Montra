<?php

namespace App\Services\Intelligence\Rules;

use App\Models\Budget;
use App\Models\Workspace;
use App\Services\BudgetProgressService;
use App\Services\Intelligence\Contracts\InsightRule;
use Illuminate\Support\Carbon;

class BudgetWarningRule implements InsightRule
{
    public function __construct(
        protected BudgetProgressService $budgetService,
    ) {}

    public function key(): string
    {
        return 'budget_warning';
    }

    public function name(): string
    {
        return 'Peringatan Penggunaan Anggaran';
    }

    public function category(): string
    {
        return 'budget_warning';
    }

    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $budgets = Budget::query()
            ->where('workspace_id', $workspace->id)
            ->active()
            ->where(function ($query) use ($startDate, $endDate): void {
                $query->whereBetween('period_start', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
                    ->orWhereBetween('period_end', [$startDate->format('Y-m-d'), $endDate->format('Y-m-d')])
                    ->orWhere(function ($q) use ($startDate, $endDate): void {
                        $q->where('period_start', '<=', $startDate->format('Y-m-d'))
                            ->where('period_end', '>=', $endDate->format('Y-m-d'));
                    });
            })
            ->with(['budgetCategories.category'])
            ->get();

        if ($budgets->isEmpty()) {
            return [];
        }

        $progressList = $this->budgetService->calculateMany($budgets);
        $insights = [];

        foreach ($budgets as $budget) {
            $progress = $progressList[$budget->id] ?? null;
            if (! $progress) {
                continue;
            }

            $warning = $progress['warning'] ?? 'on_track';
            $utilization = (float) ($progress['utilization'] ?? 0);

            if ($warning === 'on_track' && $utilization < 70) {
                continue;
            }

            $ruleKey = match ($warning) {
                'exceeded' => 'budget_exceeded',
                'critical' => 'budget_critical',
                default => 'budget_warning',
            };

            $severity = match ($warning) {
                'exceeded', 'critical' => 'critical',
                default => 'warning',
            };

            $title = match ($warning) {
                'exceeded' => "Anggaran Terlampaui: {$budget->name}",
                'critical' => "Anggaran Mendekati Batas: {$budget->name}",
                default => "Peringatan Anggaran: {$budget->name}",
            };

            $description = match ($warning) {
                'exceeded' => "Pengeluaran untuk anggaran {$budget->name} telah melebihi alokasi ({$progress['utilization']}%).",
                'critical' => "Penggunaan anggaran {$budget->name} telah mencapai {$progress['utilization']}%, mendekati batas maksimal.",
                default => "Penggunaan anggaran {$budget->name} telah mencapai {$progress['utilization']}%.",
            };

            $fingerprint = hash('sha256', "{$workspace->id}:{$ruleKey}:{$budget->id}:{$budget->period_start->format('Y-m-d')}");

            $insights[] = [
                'rule_key' => $ruleKey,
                'title' => $title,
                'description' => $description,
                'severity' => $severity,
                'period_start' => $budget->period_start->format('Y-m-d'),
                'period_end' => $budget->period_end->format('Y-m-d'),
                'supporting_data' => [
                    'budget_id' => $budget->id,
                    'budget_name' => $budget->name,
                    'total_amount' => (string) $budget->total_amount,
                    'actual_amount' => (string) $progress['actual_amount'],
                    'remaining_amount' => (string) $progress['remaining_amount'],
                    'utilization' => (string) $progress['utilization'],
                ],
                'fingerprint' => $fingerprint,
            ];
        }

        return $insights;
    }
}
