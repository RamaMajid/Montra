<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use OverflowException;

class AccountBalanceService
{
    /**
     * Checked signed 64-bit integer addition.
     * Throws OverflowException rather than converting to float or silently truncating.
     */
    public static function add(int $a, int $b): int
    {
        if ($b > 0 && $a > PHP_INT_MAX - $b) {
            throw new OverflowException("Monetary integer overflow: {$a} + {$b} exceeds PHP_INT_MAX.");
        }
        if ($b < 0 && $a < PHP_INT_MIN - $b) {
            throw new OverflowException("Monetary integer overflow: {$a} + {$b} drops below PHP_INT_MIN.");
        }

        return $a + $b;
    }

    /**
     * Checked signed 64-bit integer subtraction.
     * Throws OverflowException rather than converting to float or silently truncating.
     */
    public static function sub(int $a, int $b): int
    {
        if ($b < 0 && $a > PHP_INT_MAX + $b) {
            throw new OverflowException("Monetary integer overflow: {$a} - {$b} exceeds PHP_INT_MAX.");
        }
        if ($b > 0 && $a < PHP_INT_MIN + $b) {
            throw new OverflowException("Monetary integer overflow: {$a} - {$b} drops below PHP_INT_MIN.");
        }

        return $a - $b;
    }

    /**
     * Safely parse a database BIGINT aggregate into a PHP integer.
     */
    public static function parseBigInt(mixed $value): int
    {
        if ($value === null || $value === '' || $value === 0 || $value === '0') {
            return 0;
        }

        if (is_int($value)) {
            return $value;
        }

        $str = (string) $value;
        if (! preg_match('/^-?(0|[1-9][0-9]*)$/D', $str) || filter_var($str, FILTER_VALIDATE_INT) === false) {
            throw new OverflowException("Monetary integer overflow or invalid value: {$str}");
        }

        return (int) $str;
    }

    /**
     * Calculate derived balance for a single account.
     * Formula: Initial Balance + Income - Expense + Transfer In - Transfer Out.
     */
    public function calculate(Account $account): int
    {
        $aggregates = DB::table('transactions')
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'income' AND account_id = ? THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' AND account_id = ? THEN amount ELSE 0 END), 0) AS total_expense,
                COALESCE(SUM(CASE WHEN type = 'transfer' AND destination_account_id = ? THEN amount ELSE 0 END), 0) AS total_transfer_in,
                COALESCE(SUM(CASE WHEN type = 'transfer' AND source_account_id = ? THEN amount ELSE 0 END), 0) AS total_transfer_out
            ", [$account->id, $account->id, $account->id, $account->id])
            ->where('workspace_id', $account->workspace_id)
            ->whereNull('deleted_at')
            ->first();

        $income = self::parseBigInt($aggregates->total_income ?? 0);
        $expense = self::parseBigInt($aggregates->total_expense ?? 0);
        $transferIn = self::parseBigInt($aggregates->total_transfer_in ?? 0);
        $transferOut = self::parseBigInt($aggregates->total_transfer_out ?? 0);

        $balance = (int) $account->initial_balance;
        $balance = self::add($balance, $income);
        $balance = self::sub($balance, $expense);
        $balance = self::add($balance, $transferIn);
        $balance = self::sub($balance, $transferOut);

        return $balance;
    }

    /**
     * Efficiently calculate derived balances for all accounts in a workspace.
     *
     * @return array<int, int>
     */
    public function getBalancesForWorkspace(Workspace $workspace): array
    {
        $accounts = $workspace->accounts()->get();
        if ($accounts->isEmpty()) {
            return [];
        }

        $incomeExpense = DB::table('transactions')
            ->selectRaw("
                account_id,
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
            ")
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->whereNotNull('account_id')
            ->groupBy('account_id')
            ->get()
            ->keyBy('account_id');

        $transfersOut = DB::table('transactions')
            ->selectRaw('source_account_id, COALESCE(SUM(amount), 0) AS total_out')
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->where('type', 'transfer')
            ->whereNotNull('source_account_id')
            ->groupBy('source_account_id')
            ->pluck('total_out', 'source_account_id');

        $transfersIn = DB::table('transactions')
            ->selectRaw('destination_account_id, COALESCE(SUM(amount), 0) AS total_in')
            ->where('workspace_id', $workspace->id)
            ->whereNull('deleted_at')
            ->where('type', 'transfer')
            ->whereNotNull('destination_account_id')
            ->groupBy('destination_account_id')
            ->pluck('total_in', 'destination_account_id');

        $balances = [];
        foreach ($accounts as $account) {
            $accId = (int) $account->id;
            $income = self::parseBigInt($incomeExpense[$accId]->total_income ?? 0);
            $expense = self::parseBigInt($incomeExpense[$accId]->total_expense ?? 0);
            $transferIn = self::parseBigInt($transfersIn[$accId] ?? 0);
            $transferOut = self::parseBigInt($transfersOut[$accId] ?? 0);

            $bal = (int) $account->initial_balance;
            $bal = self::add($bal, $income);
            $bal = self::sub($bal, $expense);
            $bal = self::add($bal, $transferIn);
            $bal = self::sub($bal, $transferOut);

            $balances[$accId] = $bal;
        }

        return $balances;
    }
}
