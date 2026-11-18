<?php

namespace App\Http\Requests;

use App\Models\Transaction;
use App\Models\Workspace;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $this->session()->get('active_workspace_id'));
        Gate::authorize('view', $workspace);

        $transaction = $this->route('transaction');
        if ($transaction instanceof Transaction) {
            if ((int) $transaction->workspace_id !== (int) $workspace->id) {
                abort(404);
            }
            Gate::authorize('update', $transaction);
        } else {
            Gate::authorize('create', [Transaction::class, $workspace]);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['description', 'notes'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }

        foreach (['account_id', 'category_id', 'source_account_id', 'destination_account_id'] as $idField) {
            if ($this->input($idField) === '') {
                $this->merge([$idField => null]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return self::transactionRules($this->input('type'));
    }

    /** @return array<string, mixed> */
    public static function transactionRules(mixed $type): array
    {
        $amount = function (string $attribute, mixed $value, Closure $fail): void {
            if ((! is_string($value) && ! is_int($value)) || ! preg_match('/^[1-9][0-9]*$/D', (string) $value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
                $fail('Enter a positive whole Rupiah amount within the signed 64-bit range.');
            }
        };

        $isIncomeOrExpense = in_array($type, ['income', 'expense'], true);
        $isTransfer = $type === 'transfer';

        return [
            'type' => ['required', Rule::in(['income', 'expense', 'transfer'])],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', $amount],
            'transaction_date' => ['required', 'date_format:Y-m-d'],
            'account_id' => [
                Rule::requiredIf($isIncomeOrExpense),
                Rule::prohibitedIf($isTransfer),
                'nullable',
                'integer',
            ],
            'category_id' => [
                Rule::requiredIf($isIncomeOrExpense),
                Rule::prohibitedIf($isTransfer),
                'nullable',
                'integer',
            ],
            'source_account_id' => [
                Rule::requiredIf($isTransfer),
                Rule::prohibitedIf($isIncomeOrExpense),
                'nullable',
                'integer',
            ],
            'destination_account_id' => [
                Rule::requiredIf($isTransfer),
                Rule::prohibitedIf($isIncomeOrExpense),
                'nullable',
                'integer',
                ...($isTransfer ? ['different:source_account_id'] : []),
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
