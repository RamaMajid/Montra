<?php

namespace App\Services;

use App\Models\Workspace;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Builds the Phase 8 reports as uniform {columns, rows, totals} payloads.
 * Reuses analytics, budget and savings services; owns no financial rules.
 */
class ReportService
{
    public const TYPES = ['monthly-summary', 'income', 'expense', 'category', 'budget', 'savings'];

    public function __construct(
        protected FinancialAnalyticsService $analytics,
        protected SavingsGoalService $savings,
    ) {}

    /**
     * @param  array<string, mixed>  $filters  validated dashboard filters
     * @return array{report: string, period: array{type: string, start_date: string, end_date: string}, columns: array<int, string>, rows: array<int, array<string, string|int|null>>, totals: array<string, string>}
     */
    public function build(Workspace $workspace, string $type, array $filters): array
    {
        $period = $this->analytics->resolvePeriod($filters);
        $start = $period['start_date'];
        $end = $period['end_date'];

        [$columns, $rows, $totals] = match ($type) {
            'monthly-summary' => $this->monthlySummary($workspace, $period),
            'income' => $this->byCategory($workspace, $start, $end, ['income']),
            'expense' => $this->byCategory($workspace, $start, $end, ['expense']),
            'category' => $this->byCategory($workspace, $start, $end, ['income', 'expense']),
            'budget' => $this->budget($workspace, $start, $end),
            'savings' => $this->savingsGoals($workspace),
            default => throw new \InvalidArgumentException("Unsupported report type [{$type}]."),
        };

        return [
            'report' => $type,
            'period' => [
                'type' => $period['period'],
                'start_date' => $start->format('Y-m-d'),
                'end_date' => $end->format('Y-m-d'),
            ],
            'columns' => $columns,
            'rows' => $rows,
            'totals' => $totals,
        ];
    }

    /**
     * @param  array{start_date: Carbon, end_date: Carbon, period: string}  $period
     * @return array{0: array<int, string>, 1: array<int, array<string, string|int|null>>, 2: array<string, string>}
     */
    private function monthlySummary(Workspace $workspace, array $period): array
    {
        $s = $this->analytics->getSummary($workspace, $period['start_date'], $period['end_date'], null, $period['period']);
        $c = $s['comparison'];
        $metrics = [
            'total_income' => $s['total_income'],
            'total_expense' => $s['total_expense'],
            'net_cash_flow' => $s['net_cash_flow'],
            'savings_rate' => $s['savings_rate'],
            'total_balance' => $s['total_balance'],
            'income_count' => $s['transaction_counts']['income'],
            'expense_count' => $s['transaction_counts']['expense'],
            'transfer_count' => $s['transaction_counts']['transfer'],
            'income_change' => $c['income_change'],
            'income_change_percentage' => $c['income_change_percentage'],
            'expense_change' => $c['expense_change'],
            'expense_change_percentage' => $c['expense_change_percentage'],
            'net_cash_flow_change' => $c['net_cash_flow_change'],
        ];

        $rows = [];
        foreach ($metrics as $metric => $value) {
            $rows[] = ['metric' => $metric, 'value' => $value === null ? null : (string) $value];
        }

        return [['metric', 'value'], $rows, [
            'total_income' => $s['total_income'],
            'total_expense' => $s['total_expense'],
            'net_cash_flow' => $s['net_cash_flow'],
        ]];
    }

    /**
     * Income/expense only; transfers are never grouped here.
     *
     * @param  array<int, string>  $types
     * @return array{0: array<int, string>, 1: array<int, array<string, string|int|null>>, 2: array<string, string>}
     */
    private function byCategory(Workspace $workspace, Carbon $start, Carbon $end, array $types): array
    {
        $groups = DB::table('transactions as t')
            ->join('categories as c', function ($join): void {
                $join->on('c.id', '=', 't.category_id')->on('c.workspace_id', '=', 't.workspace_id');
            })
            ->selectRaw('t.type, c.id AS category_id, c.name AS category_name, SUM(t.amount) AS total, COUNT(*) AS transaction_count')
            ->where('t.workspace_id', $workspace->id)
            ->whereIn('t.type', $types)
            ->whereNull('t.deleted_at')
            ->whereBetween('t.transaction_date', [$start->format('Y-m-d'), $end->format('Y-m-d')])
            ->groupBy('t.type', 'c.id', 'c.name')
            ->orderBy('t.type')
            ->orderByDesc('total')
            ->orderBy('c.id')
            ->get();

        $typeTotals = array_fill_keys($types, 0);
        foreach ($groups as $g) {
            $typeTotals[$g->type] = AccountBalanceService::add($typeTotals[$g->type], AccountBalanceService::parseBigInt($g->total));
        }

        $rows = [];
        foreach ($groups as $g) {
            $amount = AccountBalanceService::parseBigInt($g->total);
            $rows[] = [
                'type' => $g->type,
                'category_id' => (int) $g->category_id,
                'category_name' => $g->category_name,
                'amount' => (string) $amount,
                'transaction_count' => (int) $g->transaction_count,
                'percentage' => $this->analytics->percentage($amount, $typeTotals[$g->type]) ?? '0',
            ];
        }

        $totals = [];
        foreach ($typeTotals as $t => $v) {
            $totals["total_{$t}"] = (string) $v;
        }
        if (count($types) === 2) {
            $totals['net_cash_flow'] = (string) AccountBalanceService::sub($typeTotals['income'], $typeTotals['expense']);
        }

        return [['type', 'category_id', 'category_name', 'amount', 'transaction_count', 'percentage'], $rows, $totals];
    }

    /**
     * One row per budget plus one per allocation (blank category_name = budget level).
     *
     * @return array{0: array<int, string>, 1: array<int, array<string, string|int|null>>, 2: array<string, string>}
     */
    private function budget(Workspace $workspace, Carbon $start, Carbon $end): array
    {
        $rows = [];
        $total = 0;
        $actual = 0;
        foreach ($this->analytics->getBudgetOverview($workspace, $start, $end) as $b) {
            $total = AccountBalanceService::add($total, (int) $b['total_amount']);
            $actual = AccountBalanceService::add($actual, (int) $b['actual_amount']);
            $base = ['budget_id' => $b['budget_id'], 'budget_name' => $b['name'], 'period_start' => $b['period_start'], 'period_end' => $b['period_end']];
            $rows[] = $base + [
                'category_name' => '',
                'budgeted_amount' => $b['total_amount'],
                'actual_amount' => $b['actual_amount'],
                'remaining_amount' => $b['remaining_amount'],
                'utilization' => $b['utilization'],
                'warning' => $b['warning'],
            ];
            foreach ($b['allocations'] as $a) {
                $rows[] = $base + [
                    'category_name' => $a['category_name'],
                    'budgeted_amount' => $a['allocated_amount'],
                    'actual_amount' => $a['actual_amount'],
                    'remaining_amount' => $a['remaining_amount'],
                    'utilization' => $a['utilization'],
                    'warning' => $a['warning'],
                ];
            }
        }

        return [
            ['budget_id', 'budget_name', 'period_start', 'period_end', 'category_name', 'budgeted_amount', 'actual_amount', 'remaining_amount', 'utilization', 'warning'],
            $rows,
            ['total_budgeted' => (string) $total, 'total_actual' => (string) $actual],
        ];
    }

    /**
     * Point-in-time progress of non-archived goals; the period filter does not apply.
     *
     * @return array{0: array<int, string>, 1: array<int, array<string, string|int|null>>, 2: array<string, string>}
     */
    private function savingsGoals(Workspace $workspace): array
    {
        $goals = $workspace->savingsGoals()->notArchived()->orderBy('name')->orderBy('id')->get();
        $progress = $this->savings->calculateMany($goals);

        $rows = [];
        $target = 0;
        $saved = 0;
        foreach ($goals as $goal) {
            $p = $progress[$goal->id];
            $target = AccountBalanceService::add($target, $goal->target_amount);
            $saved = AccountBalanceService::add($saved, (int) $p['total_contributions']);
            $rows[] = [
                'goal_id' => $goal->id,
                'name' => $goal->name,
                'status' => $goal->status,
                'target_date' => $goal->target_date?->format('Y-m-d'),
                'target_amount' => $p['target_amount'],
                'total_contributions' => $p['total_contributions'],
                'remaining_amount' => $p['remaining_amount'],
                'progress_percentage' => $p['progress_percentage'],
            ];
        }

        return [
            ['goal_id', 'name', 'status', 'target_date', 'target_amount', 'total_contributions', 'remaining_amount', 'progress_percentage'],
            $rows,
            ['total_target' => (string) $target, 'total_saved' => (string) $saved],
        ];
    }
}
