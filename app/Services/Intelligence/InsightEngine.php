<?php

namespace App\Services\Intelligence;

use App\Models\FinancialInsight;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Intelligence\Contracts\InsightRule;
use App\Services\Intelligence\Rules\BudgetWarningRule;
use App\Services\Intelligence\Rules\IncomeChangeRule;
use App\Services\Intelligence\Rules\SavingsProgressRule;
use App\Services\Intelligence\Rules\SpendingPatternRule;
use App\Services\Intelligence\Rules\UnusualTransactionRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class InsightEngine
{
    /** @var array<int, InsightRule> */
    protected array $rules = [];

    public function __construct(
        BudgetWarningRule $budgetRule,
        SpendingPatternRule $spendingRule,
        IncomeChangeRule $incomeRule,
        SavingsProgressRule $savingsRule,
        UnusualTransactionRule $unusualRule,
    ) {
        $this->rules = [
            $budgetRule,
            $spendingRule,
            $incomeRule,
            $savingsRule,
            $unusualRule,
        ];
    }

    /**
     * Register a custom rule.
     */
    public function registerRule(InsightRule $rule): self
    {
        $this->rules[] = $rule;

        return $this;
    }

    /**
     * @return array<int, InsightRule>
     */
    public function getRules(): array
    {
        return $this->rules;
    }

    /**
     * Run all rules for the workspace and save new insights idempotently.
     *
     * @return Collection<int, FinancialInsight>
     */
    public function evaluateWorkspace(Workspace $workspace, ?Carbon $startDate = null, ?Carbon $endDate = null): Collection
    {
        $now = Carbon::now();
        $startDate = $startDate ?? $now->copy()->startOfMonth();
        $endDate = $endDate ?? $now->copy()->endOfMonth();

        $generated = [];
        foreach ($this->rules as $rule) {
            $ruleInsights = $rule->evaluate($workspace, $startDate, $endDate);
            foreach ($ruleInsights as $item) {
                $generated[] = $item;
            }
        }

        if (! empty($generated)) {
            $records = [];
            foreach ($generated as $item) {
                $records[$item['fingerprint']] = [
                    'workspace_id' => $workspace->id,
                    'rule_key' => $item['rule_key'],
                    'title' => $item['title'],
                    'description' => $item['description'],
                    'severity' => $item['severity'],
                    'period_start' => $item['period_start'],
                    'period_end' => $item['period_end'],
                    'supporting_data' => json_encode($item['supporting_data'], JSON_THROW_ON_ERROR),
                    'is_read' => false,
                    'fingerprint' => $item['fingerprint'],
                    'generated_at' => $now->toDateTimeString(),
                    'created_at' => $now->toDateTimeString(),
                    'updated_at' => $now->toDateTimeString(),
                ];
            }

            ksort($records);
            DB::table('financial_insights')->upsert(array_values($records), ['workspace_id', 'fingerprint'], [
                'rule_key', 'title', 'description', 'severity', 'period_start', 'period_end',
                'supporting_data', 'generated_at', 'updated_at',
            ]);
        }

        return $this->getInsights($workspace);
    }

    /**
     * Retrieve insights for workspace with optional filters.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, FinancialInsight>
     */
    public function getInsights(Workspace $workspace, array $filters = []): Collection
    {
        $query = FinancialInsight::query()
            ->where('workspace_id', $workspace->id)
            ->orderByDesc('generated_at')
            ->orderByDesc('id');

        if (isset($filters['rule_key']) && $filters['rule_key']) {
            $query->where('rule_key', (string) $filters['rule_key']);
        }

        if (isset($filters['severity']) && in_array($filters['severity'], ['info', 'warning', 'critical'], true)) {
            $query->where('severity', (string) $filters['severity']);
        }

        if (isset($filters['is_read']) && $filters['is_read'] !== '') {
            $isRead = filter_var($filters['is_read'], FILTER_VALIDATE_BOOLEAN);
            $query->where('is_read', $isRead);
        }

        return $query->get();
    }

    public function markAsRead(User $user, FinancialInsight $insight): void
    {
        Gate::forUser($user)->authorize('update', $insight);
        $insight->update(['is_read' => true]);
    }

    public function markAllAsRead(User $user, Workspace $workspace): int
    {
        Gate::forUser($user)->authorize('update', (new FinancialInsight([
            'workspace_id' => $workspace->id,
        ]))->setRelation('workspace', $workspace));

        return FinancialInsight::query()
            ->where('workspace_id', $workspace->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);
    }
}
