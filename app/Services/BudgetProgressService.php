<?php

namespace App\Services;

use App\Models\Budget;
use Illuminate\Support\Facades\DB;

class BudgetProgressService
{
    /** @return array<string, mixed> */
    public function calculate(Budget $budget): array
    {
        $totals = DB::table('transactions')
            ->selectRaw('category_id, COALESCE(SUM(amount), 0) AS actual')
            ->where('workspace_id', $budget->workspace_id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$budget->period_start->format('Y-m-d'), $budget->period_end->format('Y-m-d')])
            ->groupBy('category_id')
            ->pluck('actual', 'category_id');

        $actual = 0;
        foreach ($totals as $total) {
            $actual = AccountBalanceService::add($actual, AccountBalanceService::parseBigInt($total));
        }

        return [
            'actual_amount' => (string) $actual,
            'remaining_amount' => (string) AccountBalanceService::sub((int) $budget->total_amount, $actual),
            'utilization' => $this->percentage($actual, (int) $budget->total_amount),
            'warning' => $this->warning($actual, (int) $budget->total_amount),
            'allocations' => $budget->budgetCategories->map(function ($allocation) use ($totals): array {
                $spent = AccountBalanceService::parseBigInt($totals[$allocation->category_id] ?? 0);

                return [
                    'category_id' => $allocation->category_id,
                    'category_name' => $allocation->category->name,
                    'category_active' => $allocation->category->is_active,
                    'allocated_amount' => (string) $allocation->allocated_amount,
                    'actual_amount' => (string) $spent,
                    'remaining_amount' => (string) AccountBalanceService::sub((int) $allocation->allocated_amount, $spent),
                    'utilization' => $this->percentage($spent, (int) $allocation->allocated_amount),
                    'warning' => $this->warning($spent, (int) $allocation->allocated_amount),
                ];
            })->values()->all(),
        ];
    }

    private function percentage(int $actual, int $budget): ?string
    {
        if ($budget <= 0) {
            return null;
        }

        $whole = intdiv($actual, $budget);
        $remainder = $actual % $budget;
        $fraction = 0;
        for ($i = 1; $i < 100; $i++) {
            if ($remainder < $this->threshold($budget, $i, 100)) {
                break;
            }
            $fraction = $i;
        }

        return ltrim((string) $whole.str_pad((string) $fraction, 2, '0', STR_PAD_LEFT), '0') ?: '0';
    }

    private function warning(int $actual, int $budget): string
    {
        if ($actual >= $budget) {
            return 'exceeded';
        }
        if ($actual >= $this->threshold($budget, 9, 10)) {
            return 'critical';
        }
        if ($actual >= $this->threshold($budget, 7, 10)) {
            return 'warning';
        }

        return 'on_track';
    }

    private function threshold(int $amount, int $numerator, int $denominator): int
    {
        $whole = intdiv($amount, $denominator) * $numerator;
        $remainder = $amount % $denominator;

        return AccountBalanceService::add($whole, intdiv($remainder * $numerator + $denominator - 1, $denominator));
    }
}
