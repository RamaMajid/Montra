<?php

namespace App\Services\Intelligence\Rules;

use App\Models\Workspace;
use App\Services\AccountBalanceService;
use App\Services\FinancialAnalyticsService;
use App\Services\Intelligence\Contracts\InsightRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class IncomeChangeRule implements InsightRule
{
    public const int MIN_INCOME_THRESHOLD = 250000;

    public const int CHANGE_PERCENTAGE_THRESHOLD = 20;

    public function __construct(
        protected FinancialAnalyticsService $analyticsService,
    ) {}

    public function key(): string
    {
        return 'income_change';
    }

    public function name(): string
    {
        return 'Perubahan Pemasukan Antarperiode';
    }

    public function category(): string
    {
        return 'income_change';
    }

    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        // Current period income
        $currentIncomeRaw = DB::table('transactions')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'income')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->sum('amount');

        $currentIncome = AccountBalanceService::parseBigInt($currentIncomeRaw);

        // Previous period
        $prevDates = $this->getPreviousPeriod($startDate, $endDate);
        $prevIncomeRaw = DB::table('transactions')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'income')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$prevDates['start_date']->format('Y-m-d'), $prevDates['end_date']->format('Y-m-d')])
            ->sum('amount');

        $prevIncome = AccountBalanceService::parseBigInt($prevIncomeRaw);

        // Minimum data requirement: both periods zero = no insight
        if ($currentIncome === 0 && $prevIncome === 0) {
            return [];
        }

        // Case 1: Prior income existed, current has zero income
        if ($prevIncome >= self::MIN_INCOME_THRESHOLD && $currentIncome === 0) {
            $fingerprint = hash('sha256', "{$workspace->id}:income_zero:{$startStr}:{$endStr}");

            return [[
                'rule_key' => 'income_zero',
                'title' => 'Tidak Ada Pemasukan Tercatat',
                'description' => 'Belum ada transaksi pemasukan yang tercatat pada periode ini.',
                'severity' => 'warning',
                'period_start' => $startStr,
                'period_end' => $endStr,
                'supporting_data' => [
                    'current_income' => '0',
                    'previous_income' => (string) $prevIncome,
                    'change_amount' => (string) (-$prevIncome),
                    'change_percentage' => '-100',
                ],
                'fingerprint' => $fingerprint,
            ]];
        }

        // Case 2: New income when previous had zero
        if ($prevIncome === 0 && $currentIncome >= self::MIN_INCOME_THRESHOLD) {
            $fingerprint = hash('sha256', "{$workspace->id}:income_new:{$startStr}:{$endStr}");

            return [[
                'rule_key' => 'income_increase',
                'title' => 'Pemasukan Baru Tercatat',
                'description' => 'Pemasukan sebesar Rp '.number_format($currentIncome, 0, ',', '.').' tercatat pada periode ini.',
                'severity' => 'info',
                'period_start' => $startStr,
                'period_end' => $endStr,
                'supporting_data' => [
                    'current_income' => (string) $currentIncome,
                    'previous_income' => '0',
                    'change_amount' => (string) $currentIncome,
                    'change_percentage' => '100',
                ],
                'fingerprint' => $fingerprint,
            ]];
        }

        // Case 3: Percentage change
        if ($prevIncome < self::MIN_INCOME_THRESHOLD && $currentIncome < self::MIN_INCOME_THRESHOLD) {
            return [];
        }

        $diff = AccountBalanceService::sub($currentIncome, $prevIncome);
        $pctChangeStr = $this->analyticsService->percentage(abs($diff), $prevIncome);
        $pctChange = (float) ($pctChangeStr ?? 0);

        if ($pctChange < self::CHANGE_PERCENTAGE_THRESHOLD) {
            return [];
        }

        $isIncrease = $diff > 0;
        $ruleKey = $isIncrease ? 'income_increase' : 'income_decrease';
        $severity = $isIncrease ? 'info' : 'warning';
        $direction = $isIncrease ? 'meningkat' : 'menurun';

        $title = $isIncrease ? 'Peningkatan Pemasukan' : 'Penurunan Pemasukan';
        $description = "Total pemasukan periode ini {$direction} sebesar {$pctChangeStr}% dibandingkan periode sebelumnya.";
        $fingerprint = hash('sha256', "{$workspace->id}:{$ruleKey}:{$startStr}:{$endStr}");

        return [[
            'rule_key' => $ruleKey,
            'title' => $title,
            'description' => $description,
            'severity' => $severity,
            'period_start' => $startStr,
            'period_end' => $endStr,
            'supporting_data' => [
                'current_income' => (string) $currentIncome,
                'previous_income' => (string) $prevIncome,
                'change_amount' => (string) $diff,
                'change_percentage' => ($isIncrease ? '' : '-').$pctChangeStr,
            ],
            'fingerprint' => $fingerprint,
        ]];
    }

    /**
     * @return array{start_date: Carbon, end_date: Carbon}
     */
    protected function getPreviousPeriod(Carbon $startDate, Carbon $endDate): array
    {
        if ($startDate->isSameDay($startDate->copy()->startOfMonth()) && $endDate->isSameDay($endDate->copy()->endOfMonth())) {
            $prevStart = $startDate->copy()->subMonthNoOverflow()->startOfMonth();
            $prevEnd = $prevStart->copy()->endOfMonth();

            return ['start_date' => $prevStart, 'end_date' => $prevEnd];
        }

        $durationInDays = $startDate->diffInDays($endDate) + 1;
        $prevEnd = $startDate->copy()->subDay()->endOfDay();
        $prevStart = $prevEnd->copy()->subDays($durationInDays - 1)->startOfDay();

        return ['start_date' => $prevStart, 'end_date' => $prevEnd];
    }
}
