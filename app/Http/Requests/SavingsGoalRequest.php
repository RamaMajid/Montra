<?php

namespace App\Http\Requests;

use App\Models\SavingsGoal;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class SavingsGoalRequest extends FormRequest
{
    public function authorize(): bool
    {
        $workspaceId = (int) $this->session()->get('active_workspace_id');
        if ($workspaceId <= 0) {
            return false;
        }

        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($workspaceId);
        Gate::authorize('view', $workspace);

        $goal = $this->route('savings_goal');
        if ($goal instanceof SavingsGoal) {
            if ((int) $goal->workspace_id !== (int) $workspace->id) {
                abort(404);
            }
            Gate::authorize('update', $goal);
        } else {
            Gate::authorize('create', [SavingsGoal::class, $workspace]);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }

        if (is_string($this->input('description'))) {
            $this->merge(['description' => trim($this->input('description'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'target_amount' => ['required', 'integer', 'min:1', 'max:9223372036854775807'],
            'target_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
