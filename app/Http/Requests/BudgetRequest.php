<?php

namespace App\Http\Requests;

use App\Models\Budget;
use App\Models\Workspace;
use Carbon\Exceptions\InvalidFormatException;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class BudgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $this->session()->get('active_workspace_id'));
        Gate::authorize('view', $workspace);

        $budget = $this->route('budget');
        if ($budget instanceof Budget) {
            if ((int) $budget->workspace_id !== (int) $workspace->id) {
                abort(404);
            }
            Gate::authorize('update', $budget);
        } else {
            Gate::authorize('create', [Budget::class, $workspace]);
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'period_start' => ['required', 'date_format:Y-m-d', function (string $attribute, mixed $value, Closure $fail): void {
                if (is_string($value) && ! str_ends_with($value, '-01')) {
                    $fail('Budget period must start on the first day of a calendar month.');
                }
            }],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start', function (string $attribute, mixed $value, Closure $fail): void {
                if (is_string($value) && is_string($this->input('period_start'))) {
                    try {
                        $start = Carbon::createFromFormat('!Y-m-d', $this->input('period_start'));
                    } catch (InvalidFormatException) {
                        return;
                    }
                    if (! $start || $value !== $start->endOfMonth()->format('Y-m-d')) {
                        $fail('Budget period must end on the last day of the same calendar month.');
                    }
                }
            }],
            'total_amount' => ['required', $this->positiveInteger()],
            'allocations' => ['nullable', 'array'],
            'allocations.*.category_id' => ['required', 'integer', 'distinct'],
            'allocations.*.amount' => ['required', $this->positiveInteger()],
        ];
    }

    private function positiveInteger(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ((! is_string($value) && ! is_int($value)) || ! preg_match('/^[1-9][0-9]*$/D', (string) $value) || filter_var($value, FILTER_VALIDATE_INT) === false) {
                $fail('Enter a positive whole Rupiah amount within the signed 64-bit range.');
            }
        };
    }
}
