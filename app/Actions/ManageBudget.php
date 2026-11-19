<?php

namespace App\Actions;

use App\Models\Budget;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AccountBalanceService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ManageBudget
{
    /** @param array<string, mixed> $data */
    public function save(User $user, Workspace $workspace, array $data, ?Budget $budget = null): Budget
    {
        try {
            return DB::transaction(function () use ($user, $workspace, $data, $budget): Budget {
                $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
                Gate::forUser($user)->authorize($budget ? 'update' : 'create', $budget ?? [Budget::class, $workspace]);
                $allocations = is_array($data['allocations'] ?? null) ? $data['allocations'] : [];
                unset($data['allocations']);
                $data['workspace_id'] = $workspace->id;
                $data['created_by'] = $budget !== null ? $budget->created_by : $user->id;
                $data['status'] = $budget !== null ? $budget->status : 'active';
                $duplicate = $workspace->budgets()
                    ->where('status', 'active')
                    ->where('period_start', $data['period_start'])
                    ->when($budget !== null, fn ($query) => $query->whereKeyNot($budget->id))
                    ->exists();
                if ($duplicate) {
                    throw ValidationException::withMessages(['period_start' => 'An active budget already exists for this workspace and month.']);
                }
                $budget = $budget
                    ? $workspace->budgets()->whereKey($budget->id)->lockForUpdate()->firstOrFail()
                    : $workspace->budgets()->create($data);
                if ($budget->wasRecentlyCreated === false) {
                    $budget->update($data);
                }

                $categoryIds = array_map(fn (array $item): int => (int) $item['category_id'], $allocations);
                $categories = $workspace->categories()->whereIn('id', $categoryIds)->get()->keyBy('id');
                $sum = 0;
                $rows = [];
                foreach ($allocations as $allocation) {
                    $category = $categories->get((int) $allocation['category_id']);
                    if (! $category || $category->type->value !== 'expense') {
                        throw ValidationException::withMessages(['allocations' => 'Allocations must use expense categories in this workspace.']);
                    }
                    if (! $category->is_active && ! $budget->budgetCategories()->where('category_id', $category->id)->exists()) {
                        throw ValidationException::withMessages(['allocations' => 'New allocations cannot use archived categories.']);
                    }
                    $amount = AccountBalanceService::parseBigInt($allocation['amount']);
                    if ($amount > AccountBalanceService::sub((int) $budget->total_amount, $sum)) {
                        throw ValidationException::withMessages(['allocations' => 'Allocation total cannot exceed budget total.']);
                    }
                    $sum = AccountBalanceService::add($sum, $amount);
                    $rows[] = ['category_id' => $category->id, 'allocated_amount' => $amount];
                }
                $budget->budgetCategories()->delete();
                if ($rows) {
                    $budget->budgetCategories()->createMany($rows);
                }

                return $budget->load('budgetCategories.category');
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['period_start' => 'An active budget already exists for this workspace and month.']);
        }
    }

    public function archive(User $user, Workspace $workspace, Budget $budget): void
    {
        DB::transaction(function () use ($user, $workspace, $budget): void {
            $workspace = Workspace::query()->whereKey($workspace->id)->lockForUpdate()->firstOrFail();
            $budget = $workspace->budgets()->whereKey($budget->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($user)->authorize('delete', $budget);
            $budget->update(['status' => 'archived']);
        });
    }
}
