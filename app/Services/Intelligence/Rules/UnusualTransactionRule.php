<?php

namespace App\Services\Intelligence\Rules;

use App\Models\Transaction;
use App\Models\Workspace;
use App\Services\FinancialAnalyticsService;
use App\Services\Intelligence\Contracts\InsightRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class UnusualTransactionRule implements InsightRule
{
    public const int MIN_TRANSACTION_COUNT = 3;

    public const int MIN_ABSOLUTE_AMOUNT = 500000;

    public const int MULTIPLIER = 3;

    public function __construct(
        protected FinancialAnalyticsService $analyticsService,
    ) {}

    public function key(): string
    {
        return 'unusual_transaction';
    }

    public function name(): string
    {
        return 'Deteksi Transaksi Pengeluaran Tidak Biasa';
    }

    public function category(): string
    {
        return 'unusual_transaction';
    }

    public function evaluate(Workspace $workspace, Carbon $startDate, Carbon $endDate): array
    {
        $startStr = $startDate->format('Y-m-d');
        $endStr = $endDate->format('Y-m-d');
        $isPgsql = DB::connection()->getDriverName() === 'pgsql';

        $historyCountSql = '(SELECT COUNT(*) FROM transactions AS h WHERE h.workspace_id = transactions.workspace_id AND h.type = \'expense\' AND h.deleted_at IS NULL AND h.transaction_date < transactions.transaction_date)';
        $historySumSql = $isPgsql
            ? '(SELECT COALESCE(SUM(CAST(h.amount AS NUMERIC)), 0) FROM transactions AS h WHERE h.workspace_id = transactions.workspace_id AND h.type = \'expense\' AND h.deleted_at IS NULL AND h.transaction_date < transactions.transaction_date)'
            : '(SELECT COALESCE(SUM(h.amount), 0) FROM transactions AS h WHERE h.workspace_id = transactions.workspace_id AND h.type = \'expense\' AND h.deleted_at IS NULL AND h.transaction_date < transactions.transaction_date)';

        $avgSql = $isPgsql
            ? "CAST(DIV({$historySumSql}, {$historyCountSql}) AS TEXT)"
            : "CAST(({$historySumSql} / {$historyCountSql}) AS TEXT)";

        $thresholdSql = $isPgsql
            ? "CAST(GREATEST(?, DIV({$historySumSql} * ?, {$historyCountSql}) + 1) AS TEXT)"
            : "CAST(MAX(?, (({$historySumSql} * ?) / {$historyCountSql}) + 1) AS TEXT)";

        $candidateCastSql = $isPgsql ? 'CAST(transactions.amount AS NUMERIC)' : 'transactions.amount';

        $unusualTxs = Transaction::query()
            ->select('transactions.*')
            ->selectRaw("{$historyCountSql} AS historical_count")
            ->selectRaw("{$avgSql} AS average_expense")
            ->selectRaw("{$thresholdSql} AS threshold", [
                self::MIN_ABSOLUTE_AMOUNT,
                self::MULTIPLIER,
            ])
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->where('amount', '>=', self::MIN_ABSOLUTE_AMOUNT)
            ->whereRaw("{$historyCountSql} >= ?", [self::MIN_TRANSACTION_COUNT])
            ->whereRaw("{$candidateCastSql} * {$historyCountSql} > {$historySumSql} * ?", [self::MULTIPLIER])
            ->orderByDesc('amount')
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        $insights = [];
        foreach ($unusualTxs as $tx) {
            $avgExpenseStr = (string) $tx->getAttribute('average_expense');
            $thresholdStr = (string) $tx->getAttribute('threshold');
            $formattedAmount = $this->formatRupiah((string) $tx->amount);
            $formattedAvg = $this->formatRupiah($avgExpenseStr);
            $txDesc = $tx->description ?: 'Pengeluaran';

            $fingerprint = hash('sha256', "{$workspace->id}:unusual_expense:{$tx->id}");

            $insights[] = [
                'rule_key' => 'unusual_expense',
                'title' => 'Pengeluaran Bernilai Besar',
                'description' => "Transaksi '{$txDesc}' senilai {$formattedAmount} pada {$tx->transaction_date->format('d M Y')} jauh lebih tinggi dibanding rata-rata ({$formattedAvg}).",
                'severity' => 'warning',
                'period_start' => $startStr,
                'period_end' => $endStr,
                'supporting_data' => [
                    'transaction_id' => $tx->id,
                    'amount' => (string) $tx->amount,
                    'transaction_date' => $tx->transaction_date->format('Y-m-d'),
                    'description' => $tx->description,
                    'average_expense' => $avgExpenseStr,
                    'threshold' => $thresholdStr,
                ],
                'fingerprint' => $fingerprint,
            ];
        }

        return $insights;
    }

    private function formatRupiah(string $amount): string
    {
        return 'Rp '.(preg_replace('/\B(?=(\d{3})+(?!\d))/', '.', $amount) ?? $amount);
    }
}
