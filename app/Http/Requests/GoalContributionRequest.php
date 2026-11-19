<?php

namespace App\Http\Requests;

use App\Models\GoalContribution;
use App\Models\SavingsGoal;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class GoalContributionRequest extends FormRequest
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
        if (! $goal instanceof SavingsGoal || (int) $goal->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $contribution = $this->route('contribution');
        if ($contribution instanceof GoalContribution) {
            if ((int) $contribution->savings_goal_id !== (int) $goal->id) {
                abort(404);
            }
            Gate::authorize('update', $contribution);
        } else {
            Gate::authorize('create', [GoalContribution::class, $goal]);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('notes'))) {
            $this->merge(['notes' => trim($this->input('notes'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:9223372036854775807'],
            'contribution_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
