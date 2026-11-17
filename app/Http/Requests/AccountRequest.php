<?php

namespace App\Http\Requests;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Workspace;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class AccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $this->session()->get('active_workspace_id'));
        $account = $this->route('account');
        if ($account instanceof Account) {
            Gate::authorize('update', [$account, $workspace]);
        } else {
            Gate::authorize('update', $workspace);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $account = $this->route('account');
        $accountId = $account instanceof Account ? $account->id : $account;

        return [
            'name' => ['required', 'string', 'max:255', function (string $attribute, mixed $value, Closure $fail) use ($accountId): void {
                if (! is_string($value)) {
                    return;
                }
                $query = Account::query()
                    ->where('workspace_id', $this->session()->get('active_workspace_id'))
                    ->whereRaw('lower(name) = lower(?)', [$value]);
                if ($accountId) {
                    $query->whereKeyNot($accountId);
                }
                if ($query->exists()) {
                    $fail('An account with this name already exists, including archived accounts.');
                }
            }],
            'type' => ['required', Rule::enum(AccountType::class)],
            'initial_balance' => ['required', function (string $attribute, mixed $value, Closure $fail): void {
                if ((! is_string($value) && ! is_int($value)) || ! preg_match('/^-?(0|[1-9][0-9]*)$/D', (string) $value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $fail('Enter a whole Rupiah amount within the signed 64-bit range.');

                    return;
                }
                if ((int) $value < 0 && ! in_array($this->input('type'), ['bank', 'other'], true)) {
                    $fail('Negative initial balances are only allowed for bank and other accounts.');
                }
            }],
            'institution' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:64'],
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }
}
