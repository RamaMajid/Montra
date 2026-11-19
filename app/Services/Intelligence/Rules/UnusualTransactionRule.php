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

        // Historical baseline expense statistics across non-deleted expenses
        $baseline = DB::table('transactions')
            ->selectRaw('COUNT(*) as total_count, COALESCE(AVG(amount), 0) as avg_amount')
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->first();

        $count = (int) ($baseline->total_count ?? 0);
        if ($count < self::MIN_TRANSACTION_COUNT) {
            return [];
        }

        $avgAmount = (int) round((float) ($baseline->avg_amount ?? 0));
        $threshold = max(self::MIN_ABSOLUTE_AMOUNT, $avgAmount * self::MULTIPLIER);

        $unusualTxs = Transaction::query()
            ->where('workspace_id', $workspace->id)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->whereBetween('transaction_date', [$startStr, $endStr])
            ->where('amount', '>=', $threshold)
            ->orderByDesc('amount')
            ->limit(5)
            ->get();

        $insights = [];
        foreach ($unusualTxs as $tx) {
            $formattedAmount = 'Rp '.number_format((float) $tx->amount, 0, ',', '.');
            $formattedAvg = 'Rp '.number_format($avgAmount, 0, ',', '.');
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
                    'average_expense' => (string) $avgAmount,
                    'threshold' => (string) $threshold,
                ],
                'fingerprint' => $fingerprint,
            ];
        }

        return $insights;
    }
}
