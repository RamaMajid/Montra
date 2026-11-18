<?php

namespace App\Actions;

use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageTransaction
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function save(User $user, Workspace $workspace, array $data, ?Transaction $transaction = null): Transaction
    {
        if ($transaction && (int) $transaction->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        return DB::transaction(function () use ($user, $workspace, $data, $transaction): Transaction {
            $type = $data['type'];
            $amount = (int) $data['amount'];
            $date = $data['transaction_date'];

            $accountId = null;
            $categoryId = null;
            $sourceAccountId = null;
            $destAccountId = null;

            if (in_array($type, ['income', 'expense'], true)) {
                $account = Account::query()->where('id', $data['account_id'] ?? null)->lockForUpdate()->first();
                if (! $account || (int) $account->workspace_id !== (int) $workspace->id) {
                    throw ValidationException::withMessages([
                        'account_id' => 'The selected account does not belong to this workspace.',
                    ]);
                }

                $isAccountUnchanged = $transaction && (int) $transaction->account_id === (int) $account->id;
                if (! $account->is_active && ! $isAccountUnchanged) {
                    throw ValidationException::withMessages([
                        'account_id' => 'Cannot record transactions to an archived account.',
                    ]);
                }

                $category = Category::query()->where('id', $data['category_id'] ?? null)->lockForUpdate()->first();
                if (! $category || (int) $category->workspace_id !== (int) $workspace->id) {
                    throw ValidationException::withMessages([
                        'category_id' => 'The selected category does not belong to this workspace.',
                    ]);
                }

                if ($category->type->value !== $type) {
                    throw ValidationException::withMessages([
                        'category_id' => "The selected category must be an {$type} category.",
                    ]);
                }

                $isCategoryUnchanged = $transaction && (int) $transaction->category_id === (int) $category->id;
                if (! $category->is_active && ! $isCategoryUnchanged) {
                    throw ValidationException::withMessages([
                        'category_id' => 'Cannot record transactions to an archived category.',
                    ]);
                }

                $accountId = $account->id;
                $categoryId = $category->id;
            } elseif ($type === 'transfer') {
                $sourceId = $data['source_account_id'] ?? null;
                $destId = $data['destination_account_id'] ?? null;

                if ((int) $sourceId === (int) $destId) {
                    throw ValidationException::withMessages([
                        'destination_account_id' => 'Source and destination accounts must be different.',
                    ]);
                }

                $source = Account::query()->where('id', $sourceId)->lockForUpdate()->first();
                if (! $source || (int) $source->workspace_id !== (int) $workspace->id) {
                    throw ValidationException::withMessages([
                        'source_account_id' => 'The source account does not belong to this workspace.',
                    ]);
                }

                $isSourceUnchanged = $transaction && (int) $transaction->source_account_id === (int) $source->id;
                if (! $source->is_active && ! $isSourceUnchanged) {
                    throw ValidationException::withMessages([
                        'source_account_id' => 'Cannot select an archived account as source.',
                    ]);
                }

                $dest = Account::query()->where('id', $destId)->lockForUpdate()->first();
                if (! $dest || (int) $dest->workspace_id !== (int) $workspace->id) {
                    throw ValidationException::withMessages([
                        'destination_account_id' => 'The destination account does not belong to this workspace.',
                    ]);
                }

                $isDestUnchanged = $transaction && (int) $transaction->destination_account_id === (int) $dest->id;
                if (! $dest->is_active && ! $isDestUnchanged) {
                    throw ValidationException::withMessages([
                        'destination_account_id' => 'Cannot select an archived account as destination.',
                    ]);
                }

                $sourceAccountId = $source->id;
                $destAccountId = $dest->id;
            }

            if (! $transaction) {
                $transaction = new Transaction;
                $transaction->workspace_id = $workspace->id;
                $transaction->created_by = $user->id;
                $transaction->source = $data['source'] ?? 'manual';
                $transaction->import_batch_id = $data['import_batch_id'] ?? null;
            }

            $transaction->type = $type;
            $transaction->description = $data['description'];
            $transaction->amount = $amount;
            $transaction->transaction_date = $date;
            $transaction->account_id = $accountId;
            $transaction->category_id = $categoryId;
            $transaction->source_account_id = $sourceAccountId;
            $transaction->destination_account_id = $destAccountId;
            $transaction->notes = $data['notes'] ?? null;
            $transaction->save();

            return $transaction;
        });
    }

    public function delete(Transaction $transaction): void
    {
        DB::transaction(function () use ($transaction): void {
            $transaction->delete();
        });
    }
}
