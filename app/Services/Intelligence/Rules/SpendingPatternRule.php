<?php

namespace App\Services\Intelligence\Rules;

use App\Models\Category;
use App\Models\Workspace;
use App\Services\AccountBalanceService;
use App\Services\FinancialAnalyticsService;
use App\Services\Intelligence\Contracts\InsightRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SpendingPatternRule implements InsightRule
{
    public const int MIN_EXPENSE_THRESHOLD = 250000;

    public const int CHANGE_PERCENTAGE_THRESHOLD = 20;

    public function __construct(
        protected FinancialAnalyticsService $analyticsService,
    ) {}

    public function key(): string
    {
        return 'spending_pattern';
    }

    public function name(): string
    {
        return 'Pola Perubahan Pengeluaran Kategori';
    }

    public function category(): string
    {
        return 'spending_pattern';
    }

    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');

        // Current period expense by category
        $currentRows = DB::table('transactions')
            ->selectRaw('category_id, COALESCE(SUM(amount), 0) as total')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->groupBy('category_id')
            ->pluck('total', 'category_id')
            ->all();

        // Previous period
        $prevDates = $this->getPreviousPeriod($startDate, $endDate);
        $prevRows = DB::table('transactions')
            ->selectRaw('category_id, COALESCE(SUM(amount), 0) as total')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$prevDates['start_date']->format('Y-m-d'), $prevDates['end_date']->format('Y-m-d')])
            ->groupBy('category_id')
            ->pluck('total', 'category_id')
            ->all();

        $allCategoryIds = array_unique(array_merge(array_keys($currentRows), array_keys($prevRows)));
        if (empty($allCategoryIds)) {
            return [];
        }

        $categories = Category::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', $allCategoryIds)
            ->get()
            ->keyBy('id');

        $insights = [];

        foreach ($allCategoryIds as $catId) {
            $catId = (int) $catId;
            $cat = $categories->get($catId);
            $catName = $cat !== null ? $cat->name : 'Kategori';

            $current = AccountBalanceService::parseBigInt($currentRows[$catId] ?? 0);
            $previous = AccountBalanceService::parseBigInt($prevRows[$catId] ?? 0);

            // Minimum data requirement: at least one period must reach threshold
            if ($current < self::MIN_EXPENSE_THRESHOLD && $previous < self::MIN_EXPENSE_THRESHOLD) {
                continue;
            }

            if ($previous === 0) {
                // New major spending in category
                $fingerprint = hash('sha256', "{$workspace->id}:spending_new:{$catId}:{$startStr}:{$endStr}");
                $insights[] = [
                    'rule_key' => 'spending_increase',
                    'title' => "Pengeluaran Baru: {$catName}",
                    'description' => 'Pengeluaran baru sebesar Rp '.number_format($current, 0, ',', '.')." tercatat pada kategori {$catName}.",
                    'severity' => 'info',
                    'period_start' => $startStr,
                    'period_end' => $endStr,
                    'supporting_data' => [
                        'category_id' => $catId,
                        'category_name' => $catName,
                        'current_amount' => (string) $current,
                        'previous_amount' => '0',
                        'change_amount' => (string) $current,
                        'change_percentage' => '100',
                    ],
                    'fingerprint' => $fingerprint,
                ];

                continue;
            }

            $diff = AccountBalanceService::sub($current, $previous);
            $pctChangeStr = $this->analyticsService->percentage(abs($diff), $previous);
            $pctChange = (float) ($pctChangeStr ?? 0);

            if ($pctChange < self::CHANGE_PERCENTAGE_THRESHOLD) {
                continue;
            }

            $isIncrease = $diff > 0;
            $ruleKey = $isIncrease ? 'spending_increase' : 'spending_decrease';
            $severity = $isIncrease ? 'warning' : 'info';
            $direction = $isIncrease ? 'meningkat' : 'menurun';

            $title = $isIncrease
                ? "Peningkatan Pengeluaran: {$catName}"
                : "Penurunan Pengeluaran: {$catName}";

            $description = "Pengeluaran kategori {$catName} {$direction} sebesar {$pctChangeStr}% dibandingkan periode sebelumnya.";
            $fingerprint = hash('sha256', "{$workspace->id}:{$ruleKey}:{$catId}:{$startStr}:{$endStr}");

            $insights[] = [
                'rule_key' => $ruleKey,
                'title' => $title,
                'description' => $description,
                'severity' => $severity,
                'period_start' => $startStr,
                'period_end' => $endStr,
                'supporting_data' => [
                    'category_id' => $catId,
                    'category_name' => $catName,
                    'current_amount' => (string) $current,
                    'previous_amount' => (string) $previous,
                    'change_amount' => (string) $diff,
                    'change_percentage' => $pctChangeStr ?? '0',
                ],
                'fingerprint' => $fingerprint,
            ];
        }

        return $insights;
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
