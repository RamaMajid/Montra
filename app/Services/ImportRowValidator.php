<?php

namespace App\Services;

use App\Http\Requests\TransactionRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\Workspace;
use Illuminate\Support\Facades\Validator;

class ImportRowValidator
{
    /** @param array<string, mixed> $data */
    public function validate(Workspace $workspace, array $data): ?string
    {
        $validator = Validator::make($data, TransactionRequest::transactionRules($data['type'] ?? null));
        if ($validator->fails()) {
            return $validator->errors()->first();
        }

        if (in_array($data['type'], ['income', 'expense'], true)) {
            $account = Account::query()->where('workspace_id', $workspace->id)->where('id', $data['account_id'])->first();
            if (! $account) {
                return 'Account does not belong to this workspace.';
            }
            if (! $account->is_active) {
                return 'Cannot record to an archived account.';
            }
            $category = Category::query()->where('workspace_id', $workspace->id)->where('id', $data['category_id'])->first();
            if (! $category) {
                return 'Category does not belong to this workspace.';
            }
            if (! $category->is_active) {
                return 'Cannot record to an archived category.';
            }
            if ($category->type->value !== $data['type']) {
                return "Category type must match transaction type {$data['type']}.";
            }
        } elseif ($data['type'] === 'transfer') {
            if ((int) $data['source_account_id'] === (int) $data['destination_account_id']) {
                return 'Source and destination accounts must be different.';
            }
            $source = Account::query()->where('workspace_id', $workspace->id)->where('id', $data['source_account_id'])->first();
            if (! $source || ! $source->is_active) {
                return 'Invalid or archived source account.';
            }
            $dest = Account::query()->where('workspace_id', $workspace->id)->where('id', $data['destination_account_id'])->first();
            if (! $dest || ! $dest->is_active) {
                return 'Invalid or archived destination account.';
            }
        }

        return null;
    }
}
