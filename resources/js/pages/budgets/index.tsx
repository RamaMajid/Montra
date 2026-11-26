import { Head } from '@inertiajs/react';
import { CalendarDays, History, Plus, Target } from 'lucide-react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { ArchiveBudgetDialog } from '@/components/budgets/archive-budget-dialog';
import { BudgetForm } from '@/components/budgets/budget-form';
import {
    BudgetAllocationList,
    BudgetHistory,
    BudgetSummary,
    BudgetsSkeleton,
} from '@/components/budgets/budget-list';
import type {
    BudgetItem,
    BudgetStatusFilter,
    BudgetsIndexProps,
} from '@/components/budgets/types';
export type {
    BudgetAllocationItem,
    BudgetItem,
} from '@/components/budgets/types';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { formatMonthId } from '@/lib/format-currency';
import budgetsRoutes from '@/routes/budgets';

export default function BudgetsIndex({
    budgets,
    categories = [],
    canManage = false,
}: BudgetsIndexProps) {
    const [formBudget, setFormBudget] = useState<
        BudgetItem | null | undefined
    >();
    const [archiveBudget, setArchiveBudget] = useState<BudgetItem | null>(null);
    const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>('all');
    const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(
        null,
    );

    if (!budgets) {
        return (
            <>
                <Head title="Budgets" />
                <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                    <PageHeader
                        eyebrow="Financial planning"
                        title="Budgets"
                        description="Plan monthly expense limits and monitor server-calculated spending by category."
                    />
                    <BudgetsSkeleton />
                </main>
            </>
        );
    }

    const defaultBudget =
        budgets.find((budget) => budget.status === 'active') ??
        budgets[0] ??
        null;
    const selectedBudget =
        budgets.find((budget) => budget.id === selectedBudgetId) ??
        defaultBudget;
    const filteredBudgets =
        statusFilter === 'all'
            ? budgets
            : budgets.filter((budget) => budget.status === statusFilter);

    return (
        <>
            <Head title="Budgets" />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Financial planning"
                    title="Budgets"
                    description="Plan one full calendar month at a time. Actual spending includes non-deleted expense transactions by transaction date; income and transfers are excluded."
                    actions={
                        canManage && formBudget === undefined ? (
                            <Button
                                type="button"
                                onClick={() => setFormBudget(null)}
                            >
                                <Plus aria-hidden="true" /> Create budget
                            </Button>
                        ) : undefined
                    }
                />

                {formBudget !== undefined && canManage && (
                    <BudgetForm
                        key={formBudget?.id ?? 'new-budget'}
                        budget={formBudget}
                        categories={[
                            ...categories,
                            ...(formBudget?.progress.allocations
                                .filter(
                                    (allocation) =>
                                        !categories.some(
                                            (category) =>
                                                category.id ===
                                                allocation.category_id,
                                        ),
                                )
                                .map((allocation) => ({
                                    id: allocation.category_id,
                                    name: `${allocation.category_name} (Archived)`,
                                    is_active: false,
                                })) ?? []),
                        ]}
                        onCancel={() => setFormBudget(undefined)}
                    />
                )}

                {!canManage && (
                    <section
                        aria-label="Read-only budget access"
                        className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground"
                    >
                        You have view-only access. Budget spending and history
                        remain visible, while workspace members, admins, and
                        owners can create and edit budgets.
                    </section>
                )}

                {budgets.length > 0 && selectedBudget ? (
                    <>
                        <section
                            aria-labelledby="budget-period-selector-label"
                            className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-surface p-4"
                        >
                            <div>
                                <label
                                    id="budget-period-selector-label"
                                    htmlFor="budget-period-select"
                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                                >
                                    <CalendarDays
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                    Selected budget period
                                </label>
                                <select
                                    id="budget-period-select"
                                    value={selectedBudget.id}
                                    onChange={(event) =>
                                        setSelectedBudgetId(
                                            Number(event.target.value),
                                        )
                                    }
                                    className="mt-1.5 h-10 rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    {budgets.map((budget) => (
                                        <option
                                            key={budget.id}
                                            value={budget.id}
                                        >
                                            {formatMonthId(budget.period_start)}{' '}
                                            · {budget.name} (
                                            {budget.status === 'active'
                                                ? 'Active'
                                                : 'Archived'}
                                            )
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                                {canManage && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setFormBudget(selectedBudget)
                                        }
                                    >
                                        Edit budget
                                    </Button>
                                )}
                                {selectedBudget.can_archive &&
                                    selectedBudget.status === 'active' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="text-warning"
                                            onClick={() =>
                                                setArchiveBudget(selectedBudget)
                                            }
                                        >
                                            Archive budget
                                        </Button>
                                    )}
                            </div>
                        </section>
                        <BudgetSummary budget={selectedBudget} />
                        <BudgetAllocationList budget={selectedBudget} />
                    </>
                ) : (
                    <EmptyState
                        icon={Target}
                        title="No active budget"
                        description="Create a monthly budget to monitor expense spending. Archived budgets remain available below."
                        action={
                            canManage ? (
                                <Button
                                    type="button"
                                    onClick={() => setFormBudget(null)}
                                >
                                    <Plus aria-hidden="true" /> Create monthly
                                    budget
                                </Button>
                            ) : undefined
                        }
                    />
                )}

                <section aria-labelledby="budget-history-filter-heading">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
                        <div>
                            <h2
                                id="budget-history-filter-heading"
                                className="flex items-center gap-2 text-lg font-semibold"
                            >
                                <History
                                    aria-hidden="true"
                                    className="size-4"
                                />
                                Monthly history
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Backend returns budgets newest month first.
                            </p>
                        </div>
                        <div>
                            <label
                                htmlFor="budget-status-filter"
                                className="mb-1 block text-xs text-muted-foreground"
                            >
                                Show
                            </label>
                            <select
                                id="budget-status-filter"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(
                                        event.target
                                            .value as BudgetStatusFilter,
                                    )
                                }
                                className="h-10 rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <option value="all">All budgets</option>
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>
                    <BudgetHistory
                        budgets={filteredBudgets}
                        selectedBudgetId={selectedBudget?.id ?? null}
                        canManage={canManage}
                        onSelect={(budget) => setSelectedBudgetId(budget.id)}
                        onEdit={setFormBudget}
                        onArchive={setArchiveBudget}
                    />
                </section>

                <ArchiveBudgetDialog
                    budget={archiveBudget}
                    open={archiveBudget !== null}
                    onOpenChange={(open) => {
                        if (!open) setArchiveBudget(null);
                    }}
                />

                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={[
                            'Enable JavaScript to create, edit, or archive budgets.',
                        ]}
                    />
                </noscript>
            </main>
        </>
    );
}

BudgetsIndex.layout = {
    breadcrumbs: [{ title: 'Budgets', href: budgetsRoutes.index.url() }],
};
