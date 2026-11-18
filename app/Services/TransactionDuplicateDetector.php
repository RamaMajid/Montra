<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\Workspace;

class TransactionDuplicateDetector
{
    /** @param array<string, mixed> $data */
    public function isDuplicate(Workspace $workspace, array $data): bool
    {
        $query = Transaction::query()->where('workspace_id', $workspace->id)->where('type', $data['type'])
            ->whereDate('transaction_date', $data['transaction_date'])->where('amount', $data['amount'])
            ->whereRaw('lower(trim(description)) = ?', [mb_strtolower(trim($data['description']))]);
        if ($data['type'] === 'transfer') {
            $query->where('source_account_id', $data['source_account_id'])->where('destination_account_id', $data['destination_account_id']);
        } else {
            $query->where('account_id', $data['account_id']);
        }

        return $query->exists();
    }
}
