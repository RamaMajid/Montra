<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\Workspace;
use Carbon\CarbonPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialAnalyticsService
{
    public function __construct(
        protected AccountBalanceService $balanceService,
        protected BudgetProgressService $budgetService,
    ) {}

    /**
     * Get account balances keyed by account id for the workspace.
     *
     * @return array<int, int>
     */
    public function getAccountBalances(Workspace $workspace): array
    {
        return $this->balanceService->getBalancesForWorkspace($workspace);
    }

    /**
     * Resolve date range from filter parameters.
     *
     * @param  array<string, mixed>  $filters
     * @return array{start_date: Carbon, end_date: Carbon, period: string}
     */
    public function resolvePeriod(array $filters): array
    {
        $periodType = (string) ($filters['period'] ?? 'current_month');
        $now = Carbon::now();

        return match ($periodType) {
            'previous_month' => [
                'start_date' => $now->copy()->subMonthNoOverflow()->startOfMonth(),
                'end_date' => $now->copy()->subMonthNoOverflow()->endOfMonth(),
                'period' => 'previous_month',
            ],
            'custom' => [
                'start_date' => Carbon::parse((string) $filters['date_from'])->startOfDay(),
                'end_date' => Carbon::parse((string) $filters['date_to'])->endOfDay(),
                'period' => 'custom',
            ],
            default => [
                'start_date' => $now->copy()->startOfMonth(),
                'end_date' => $now->copy()->endOfMonth(),
                'period' => 'current_month',
            ],
        };
    }

    /**
     * Calculate summary metrics for the active workspace in the period.
     *
     * @param  array<int, int>|null  $accountBalances  Preloaded balances keyed by account id
     * @return array<string, mixed>
     */
    public function getSummary(Workspace $workspace, Carbon $startDate, Carbon $endDate, ?array $accountBalances = null, string $periodType = 'current_month'): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        // Income and expense totals via single query
        $aggregates = DB::table('transactions')
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
                COUNT(CASE WHEN type = 'income' THEN 1 END) AS income_count,
                COUNT(CASE WHEN type = 'expense' THEN 1 END) AS expense_count,
                COUNT(CASE WHEN type = 'transfer' THEN 1 END) AS transfer_count
            ")
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->first();

        $totalIncome = AccountBalanceService::parseBigInt($aggregates->total_income ?? 0);
        $totalExpense = AccountBalanceService::parseBigInt($aggregates->total_expense ?? 0);
        $netCashFlow = AccountBalanceService::sub($totalIncome, $totalExpense);

        // Savings rate = (Income - Expense) / Income * 100
        $savingsRate = $this->percentage($netCashFlow, $totalIncome);

        // Total active accounts balance
        $balances = $accountBalances ?? $this->balanceService->getBalancesForWorkspace($workspace);
        $activeAccountIds = $workspace->accounts()->where('is_active', true)->pluck('id')->all();

        $totalBalance = 0;
        foreach ($activeAccountIds as $accId) {
            $totalBalance = AccountBalanceService::add($totalBalance, $balances[$accId] ?? 0);
        }

        // Previous period comparison
        $prevPeriod = $this->getPreviousPeriodDates($startDate, $endDate, $periodType);
        $prevAggregates = DB::table('transactions')
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
            ")
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$prevPeriod['start_date']->format('Y-m-d'), $prevPeriod['end_date']->format('Y-m-d')])
            ->first();

        $prevIncome = AccountBalanceService::parseBigInt($prevAggregates->total_income ?? 0);
        $prevExpense = AccountBalanceService::parseBigInt($prevAggregates->total_expense ?? 0);
        $prevNet = AccountBalanceService::sub($prevIncome, $prevExpense);

        return [
            'total_balance' => (string) $totalBalance,
            'total_income' => (string) $totalIncome,
            'total_expense' => (string) $totalExpense,
            'net_cash_flow' => (string) $netCashFlow,
            'savings_rate' => $savingsRate,
            'transaction_counts' => [
                'income' => (int) ($aggregates->income_count ?? 0),
                'expense' => (int) ($aggregates->expense_count ?? 0),
                'transfer' => (int) ($aggregates->transfer_count ?? 0),
            ],
            'comparison' => [
                'previous_start' => $prevPeriod['start_date']->format('Y-m-d'),
                'previous_end' => $prevPeriod['end_date']->format('Y-m-d'),
                'income_change' => (string) AccountBalanceService::sub($totalIncome, $prevIncome),
                'income_change_percentage' => $this->percentageChange($prevIncome, $totalIncome),
                'expense_change' => (string) AccountBalanceService::sub($totalExpense, $prevExpense),
                'expense_change_percentage' => $this->percentageChange($prevExpense, $totalExpense),
                'net_cash_flow_change' => (string) AccountBalanceService::sub($netCashFlow, $prevNet),
            ],
        ];
    }

    /**
     * Get continuous time-series trend of income vs expense.
     *
     * @return array<int, array{date: string, label: string, income: string, expense: string, net: string}>
     */
    public function getTrends(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $daysDiff = (int) $startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay());
        $groupByMonth = $daysDiff >= 31;

        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        if ($groupByMonth) {
            $dateFormat = DB::connection()->getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', transaction_date)"
                : "TO_CHAR(transaction_date, 'YYYY-MM')";
            $results = DB::table('transactions')
                ->selectRaw("
                    {$dateFormat} as interval_key,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
                ")
                ->where('workspace_id', $workspace->id)
                ->whereNull('deleted_at')
                ->whereBetween('transaction_date', [$startStr, $endStr])
                ->groupBy('interval_key')
                ->get()
                ->keyBy('interval_key');

            $trends = [];
            $current = $startDate->copy()->startOfMonth();
            $endMonth = $endDate->copy()->startOfMonth();

            while ($current->lte($endMonth)) {
                $key = $current->format('Y-m');
                $inc = AccountBalanceService::parseBigInt($results[$key]->income ?? 0);
                $exp = AccountBalanceService::parseBigInt($results[$key]->expense ?? 0);

                $trends[] = [
                    'date' => $key,
                    'label' => $current->format('M Y'),
                    'income' => (string) $inc,
                    'expense' => (string) $exp,
                    'net' => (string) AccountBalanceService::sub($inc, $exp),
                ];

                $current->addMonth();
            }

            return $trends;
        }

        // Daily granularity
        $results = DB::table('transactions')
            ->selectRaw("
                transaction_date,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
            ")
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->groupBy('transaction_date')
            ->get()
            ->keyBy(fn ($item): string => Carbon::parse((string) $item->transaction_date)->format('Y-m-d'));

        $trends = [];
        $period = CarbonPeriod::create($startDate, $endDate);

        foreach ($period as $date) {
            $key = $date->format('Y-m-d');
            $inc = AccountBalanceService::parseBigInt($results[$key]->income ?? 0);
            $exp = AccountBalanceService::parseBigInt($results[$key]->expense ?? 0);

            $trends[] = [
                'date' => $key,
                'label' => $date->format('d M'),
                'income' => (string) $inc,
                'expense' => (string) $exp,
                'net' => (string) AccountBalanceService::sub($inc, $exp),
            ];
        }

        return $trends;
    }

    /**
     * Expense breakdown by category for the period.
     *
     * @return array<int, array{category_id: int, name: string, color: string|null, icon: string|null, amount: string, percentage: string}>
     */
    public function getExpenseBreakdown(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        $rows = DB::table('transactions')
            ->selectRaw('category_id, COALESCE(SUM(amount), 0) AS total_amount')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->groupBy('category_id')
            ->orderByDesc('total_amount')
            ->orderBy('category_id')
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $categoryIds = $rows->pluck('category_id')->filter()->all();
        $categories = Category::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', $categoryIds)
            ->get()
            ->keyBy('id');

        $totalExpense = 0;
        foreach ($rows as $row) {
            $totalExpense = AccountBalanceService::add($totalExpense, AccountBalanceService::parseBigInt($row->total_amount));
        }

        $breakdown = [];
        foreach ($rows as $row) {
            $catId = (int) $row->category_id;
            if (! $categories->has($catId)) {
                continue;
            }
            $cat = $categories->get($catId);
            $amount = AccountBalanceService::parseBigInt($row->total_amount);

            $percentage = $this->percentage($amount, $totalExpense) ?? '0';

            $breakdown[] = [
                'category_id' => $catId,
                'name' => $cat->name,
                'color' => $cat->color,
                'icon' => $cat?->icon,
                'amount' => (string) $amount,
                'percentage' => $percentage,
            ];
        }

        return $breakdown;
    }

    /**
     * Active account distribution and balances.
     *
     * @param  array<int, int>|null  $accountBalances  Preloaded balances keyed by account id
     * @return array<int, array{id: int, name: string, type: string, color: string|null, icon: string|null, balance: string, percentage: string}>
     */
    public function getAccountDistribution(Workspace $workspace, ?array $accountBalances = null): array
    {
        $accounts = $workspace->accounts()
            ->where('is_active', true)
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        if ($accounts->isEmpty()) {
            return [];
        }

        $balances = $accountBalances ?? $this->balanceService->getBalancesForWorkspace($workspace);

        $positiveTotal = 0;
        foreach ($accounts as $account) {
            $bal = $balances[$account->id] ?? 0;
            if ($bal > 0) {
                $positiveTotal = AccountBalanceService::add($positiveTotal, $bal);
            }
        }

        $distribution = [];
        foreach ($accounts as $account) {
            $bal = $balances[$account->id] ?? 0;
            $percentage = '0.00';
            if ($positiveTotal > 0 && $bal > 0) {
                $percentage = $this->percentage($bal, $positiveTotal) ?? '0.00';
            }

            $distribution[] = [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'color' => $account->color,
                'icon' => $account->icon,
                'balance' => (string) $bal,
                'percentage' => $percentage,
            ];
        }

        return $distribution;
    }

    /**
     * Active monthly budgets overview for the period.
     * Reuses BudgetProgressService to compute full-month progress for each overlapping active monthly budget.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getBudgetOverview(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        $budgets = Budget::query()
            ->where('workspace_id', $workspace->id)
            ->active()
            ->where(function ($query) use ($startStr, $endStr): void {
                $query->whereBetween('period_start', [$startStr, $endStr])
                    ->orWhereBetween('period_end', [$startStr, $endStr])
                    ->orWhere(function ($q) use ($startStr, $endStr): void {
                        $q->where('period_start', '<=', $startStr)
                            ->where('period_end', '>=', $endStr);
                    });
            })
            ->with(['budgetCategories.category'])
            ->orderBy('period_start', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        if ($budgets->isEmpty()) {
            return [];
        }

        $progressById = $this->budgetService->calculateMany($budgets);

        return $budgets->map(function (Budget $budget) use ($progressById): array {
            $progress = $progressById[$budget->id];

            return [
                'budget_id' => $budget->id,
                'name' => $budget->name,
                'period_start' => $budget->period_start->format('Y-m-d'),
                'period_end' => $budget->period_end->format('Y-m-d'),
                'total_amount' => (string) $budget->total_amount,
                'actual_amount' => $progress['actual_amount'],
                'remaining_amount' => $progress['remaining_amount'],
                'utilization' => $progress['utilization'],
                'warning' => $progress['warning'],
                'allocations' => $progress['allocations'],
            ];
        })->all();
    }

    /**
     * Recent transactions for the workspace.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getRecentTransactions(Workspace $workspace, int $limit = 5): array
    {
        return $workspace->transactions()
            ->with([
                'account' => fn ($query) => $query->where('workspace_id', $workspace->id)->select('id', 'name', 'type', 'color', 'icon', 'workspace_id'),
                'sourceAccount' => fn ($query) => $query->where('workspace_id', $workspace->id)->select('id', 'name', 'type', 'color', 'icon', 'workspace_id'),
                'destinationAccount' => fn ($query) => $query->where('workspace_id', $workspace->id)->select('id', 'name', 'type', 'color', 'icon', 'workspace_id'),
                'category' => fn ($query) => $query->where('workspace_id', $workspace->id)->select('id', 'name', 'type', 'color', 'icon', 'workspace_id'),
            ])
            ->orderBy('transaction_date', 'desc')
            ->orderBy('id', 'desc')
            ->limit($limit)
            ->get()
            ->map(fn (Transaction $t): array => [
                'id' => $t->id,
                'type' => $t->type,
                'description' => $t->description,
                'amount' => (string) $t->amount,
                'transaction_date' => $t->transaction_date->format('Y-m-d'),
                'account' => $t->account ? [
                    'id' => $t->account->id,
                    'name' => $t->account->name,
                    'type' => $t->account->type->value,
                    'color' => $t->account->color,
                    'icon' => $t->account->icon,
                ] : null,
                'source_account' => $t->sourceAccount ? [
                    'id' => $t->sourceAccount->id,
                    'name' => $t->sourceAccount->name,
                    'type' => $t->sourceAccount->type->value,
                    'color' => $t->sourceAccount->color,
                    'icon' => $t->sourceAccount->icon,
                ] : null,
                'destination_account' => $t->destinationAccount ? [
                    'id' => $t->destinationAccount->id,
                    'name' => $t->destinationAccount->name,
                    'type' => $t->destinationAccount->type->value,
                    'color' => $t->destinationAccount->color,
                    'icon' => $t->destinationAccount->icon,
                ] : null,
                'category' => $t->category ? [
                    'id' => $t->category->id,
                    'name' => $t->category->name,
                    'type' => $t->category->type->value,
                    'color' => $t->category->color,
                    'icon' => $t->category->icon,
                ] : null,
            ])
            ->all();
    }

    /**
     * Compute previous period dates for comparison.
     *
     * @return array{start_date: Carbon, end_date: Carbon}
     */
    public function getPreviousPeriodDates(Carbon $startDate, Carbon $endDate, string $periodType = 'current_month'): array
    {
        if ($periodType !== 'custom') {
            $prevStart = $startDate->copy()->subMonthNoOverflow()->startOfMonth();
            $prevEnd = $prevStart->copy()->endOfMonth();

            return ['start_date' => $prevStart, 'end_date' => $prevEnd];
        }

        // Calendar date arithmetic: days count inclusive
        $durationInDays = (int) $startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay()) + 1;
        $prevEnd = $startDate->copy()->subDay()->endOfDay();
        $prevStart = $prevEnd->copy()->subDays($durationInDays - 1)->startOfDay();

        return ['start_date' => $prevStart, 'end_date' => $prevEnd];
    }

    /**
     * Category trends over the period.
     *
     * @return array<int, array{category_id: int, name: string, color: string|null, icon: string|null, intervals: array<int, array{date: string, amount: string}>}>
     */
    public function getCategoryTrends(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $daysDiff = (int) $startDate->copy()->startOfDay()->diffInDays($endDate->copy()->startOfDay());
        $groupByMonth = $daysDiff >= 31;

        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        // Determine intervals list
        $intervalKeys = [];
        if ($groupByMonth) {
            $current = $startDate->copy()->startOfMonth();
            $endMonth = $endDate->copy()->startOfMonth();
            while ($current->lte($endMonth)) {
                $intervalKeys[] = $current->format('Y-m');
                $current->addMonth();
            }
            $sqlInterval = DB::connection()->getDriverName() === 'sqlite'
                ? "strftime('%Y-%m', transaction_date)"
                : "TO_CHAR(transaction_date, 'YYYY-MM')";
        } else {
            $period = CarbonPeriod::create($startDate->copy()->startOfDay(), $endDate->copy()->startOfDay());
            foreach ($period as $date) {
                $intervalKeys[] = $date->format('Y-m-d');
            }
            $sqlInterval = 'transaction_date';
        }

        $rows = DB::table('transactions')
            ->selectRaw("category_id, {$sqlInterval} as interval_key, COALESCE(SUM(amount), 0) as total_amount")
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->groupBy('category_id', 'interval_key')
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $categoryIds = $rows->pluck('category_id')->filter()->unique()->values()->all();
        $categories = Category::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', $categoryIds)
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        // Group rows by category_id and interval_key
        $grouped = [];
        foreach ($rows as $row) {
            $catId = (int) $row->category_id;
            $interval = (string) (is_string($row->interval_key) ? $row->interval_key : Carbon::parse((string) $row->interval_key)->format('Y-m-d'));
            $grouped[$catId][$interval] = AccountBalanceService::parseBigInt($row->total_amount);
        }

        $result = [];
        foreach ($categories as $cat) {
            $intervals = [];
            foreach ($intervalKeys as $key) {
                $amt = $grouped[$cat->id][$key] ?? 0;
                $intervals[] = [
                    'date' => $key,
                    'amount' => (string) $amt,
                ];
            }

            $result[] = [
                'category_id' => $cat->id,
                'name' => $cat->name,
                'color' => $cat->color,
                'icon' => $cat->icon,
                'intervals' => $intervals,
            ];
        }

        return $result;
    }

    /**
     * Savings rate trends over the period.
     *
     * @param  array<int, array{income: string, net: string, date: string, label: string}>|null  $trends
     * @return array<int, array{date: string, label: string, savings_rate: string|null}>
     */
    public function getSavingsRateTrends(Workspace $workspace, Carbon $startDate, Carbon $endDate, ?array $trends = null): array
    {
        $points = $trends ?? $this->getTrends($workspace, $startDate, $endDate);

        return array_map(function (array $point): array {
            $inc = AccountBalanceService::parseBigInt($point['income']);
            $net = AccountBalanceService::parseBigInt($point['net']);

            return [
                'date' => $point['date'],
                'label' => $point['label'],
                'savings_rate' => $this->percentage($net, $inc),
            ];
        }, $points);
    }

    /**
     * Calculate safe integer percentage string with 2 decimal places (without floats).
     */
    public function percentage(int $numerator, int $denominator): ?string
    {
        if ($denominator === 0) {
            return null;
        }

        if ($denominator < 0) {
            throw new \InvalidArgumentException('Percentage denominator must be positive.');
        }

        $digits = ltrim((string) intdiv($numerator, $denominator), '-');
        $remainder = abs($numerator % $denominator);
        // Long division avoids multiplying a BIGINT remainder or quotient.
        for ($place = 0; $place < 4; $place++) {
            $next = 0;
            $digit = 0;
            for ($step = 0; $step < 10; $step++) {
                if ($next >= $denominator - $remainder) {
                    $next -= $denominator - $remainder;
                    $digit++;
                } else {
                    $next += $remainder;
                }
            }
            $digits .= (string) $digit;
            $remainder = $next;
        }
        if ($remainder >= $denominator - $remainder) {
            for ($index = strlen($digits) - 1; $index >= 0; $index--) {
                if ($digits[$index] !== '9') {
                    $digits[$index] = (string) ((int) $digits[$index] + 1);
                    break;
                }
                $digits[$index] = '0';
            }
            if ($index < 0) {
                $digits = '1'.$digits;
            }
        }
        $whole = ltrim(substr($digits, 0, -2), '0') ?: '0';
        $fraction = rtrim(substr($digits, -2), '0');
        $formatted = $whole.($fraction === '' ? '' : '.'.$fraction);

        return ($numerator < 0 && $formatted !== '0' ? '-' : '').$formatted;
    }

    /**
     * Calculate safe percentage change.
     */
    protected function percentageChange(int $previous, int $current): ?string
    {
        if ($previous === 0) {
            return null;
        }

        $diff = AccountBalanceService::sub($current, $previous);

        return $this->percentage($diff, abs($previous));
    }
}
