import { Archive, CalendarDays, Eye, Pencil, Target } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    formatDateId,
    formatIdr,
    formatMonthId,
    formatPercent,
} from '@/lib/format-currency';
import {
    BudgetProgressBar,
    BudgetStatusBadge,
    BudgetWarningBadge,
} from './budget-status';
import type { BudgetItem } from './types';

function signedRemaining(amount: string): { text: string; className: string } {
    return BigInt(amount) < 0n
        ? {
              text: `${formatIdr(amount.slice(1))} over`,
              className: 'text-destructive',
          }
        : { text: `${formatIdr(amount)} left`, className: 'text-income' };
}

export function BudgetSummary({ budget }: { budget: BudgetItem }) {
    const remaining = signedRemaining(budget.progress.remaining_amount);

    return (
        <section
            aria-labelledby="budget-summary-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2
                            id="budget-summary-heading"
                            className="text-xl font-semibold"
                        >
                            {budget.name}
                        </h2>
                        <BudgetStatusBadge status={budget.status} />
                        <BudgetWarningBadge
                            warning={budget.progress.warning}
                            utilization={budget.progress.utilization}
                        />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays aria-hidden="true" className="size-4" />
                        <span>{formatMonthId(budget.period_start)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {formatDateId(budget.period_start)} –{' '}
                            {formatDateId(budget.period_end)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Created by {budget.creator_name}</span>
                    </p>
                </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-elevated/30 rounded-md border border-border p-3">
                    <dt className="text-xs text-muted-foreground">
                        Total budget
                    </dt>
                    <dd className="font-numeric mt-1 text-lg font-semibold">
                        {formatIdr(budget.total_amount)}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3">
                    <dt className="text-xs text-muted-foreground">
                        Actual expense
                    </dt>
                    <dd className="font-numeric mt-1 text-lg font-semibold text-expense">
                        {formatIdr(budget.progress.actual_amount)}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3">
                    <dt className="text-xs text-muted-foreground">Remaining</dt>
                    <dd
                        className={`font-numeric mt-1 text-lg font-semibold ${remaining.className}`}
                    >
                        {remaining.text}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3">
                    <dt className="text-xs text-muted-foreground">
                        Utilization
                    </dt>
                    <dd className="font-numeric mt-1 text-lg font-semibold">
                        {formatPercent(budget.progress.utilization)}
                    </dd>
                </div>
            </dl>
            <div className="mt-5">
                <BudgetProgressBar
                    label="Total budget utilization"
                    actualAmount={budget.progress.actual_amount}
                    targetAmount={budget.total_amount}
                    utilization={budget.progress.utilization}
                    warning={budget.progress.warning}
                />
            </div>
        </section>
    );
}

export function BudgetAllocationList({ budget }: { budget: BudgetItem }) {
    if (budget.progress.allocations.length === 0) {
        return (
            <EmptyState
                icon={Target}
                title="No category allocations"
                description="This budget tracks total workspace expense spending for the month. Add category allocations when you want category-level limits."
            />
        );
    }

    return (
        <section aria-labelledby="budget-allocations-heading">
            <div className="mb-3 flex items-baseline justify-between gap-4">
                <div>
                    <h2
                        id="budget-allocations-heading"
                        className="text-lg font-semibold"
                    >
                        Category allocations
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Expense transactions are matched by transaction date and
                        category. Total budget spending still includes all
                        workspace expense transactions in this month.
                    </p>
                </div>
                <span className="font-numeric text-sm text-muted-foreground">
                    {budget.progress.allocations.length} categories
                </span>
            </div>
            <ul role="list" className="grid gap-3 sm:grid-cols-2">
                {budget.progress.allocations.map((allocation) => {
                    const remaining = signedRemaining(
                        allocation.remaining_amount,
                    );
                    return (
                        <li
                            key={allocation.category_id}
                            className="rounded-md border border-border bg-surface p-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-medium">
                                        {allocation.category_name}
                                    </h3>
                                    {!allocation.category_active && (
                                        <p className="text-xs text-muted-foreground">
                                            Archived category · historical
                                            allocation
                                        </p>
                                    )}
                                </div>
                                <BudgetWarningBadge
                                    warning={allocation.warning}
                                    utilization={allocation.utilization}
                                />
                            </div>
                            <div className="mt-4">
                                <BudgetProgressBar
                                    label={`${allocation.category_name} utilization`}
                                    actualAmount={allocation.actual_amount}
                                    targetAmount={allocation.allocated_amount}
                                    utilization={allocation.utilization}
                                    warning={allocation.warning}
                                />
                            </div>
                            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Allocated
                                    </dt>
                                    <dd className="font-numeric mt-1 font-medium">
                                        {formatIdr(allocation.allocated_amount)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Actual
                                    </dt>
                                    <dd className="font-numeric mt-1 font-medium text-expense">
                                        {formatIdr(allocation.actual_amount)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Remaining
                                    </dt>
                                    <dd
                                        className={`font-numeric mt-1 font-medium ${remaining.className}`}
                                    >
                                        {remaining.text}
                                    </dd>
                                </div>
                            </dl>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export function BudgetHistory({
    budgets,
    selectedBudgetId,
    canManage = false,
    onSelect,
    onEdit,
    onArchive,
}: {
    budgets: BudgetItem[];
    selectedBudgetId?: number | null;
    canManage?: boolean;
    onSelect?: (budget: BudgetItem) => void;
    onEdit: (budget: BudgetItem) => void;
    onArchive: (budget: BudgetItem) => void;
}) {
    if (budgets.length === 0) {
        return (
            <EmptyState
                icon={Target}
                title="No budgets yet"
                description="Create a monthly budget to start monitoring expense spending."
            />
        );
    }

    return (
        <section aria-labelledby="budget-history-heading">
            <div className="mb-3">
                <h2
                    id="budget-history-heading"
                    className="text-lg font-semibold"
                >
                    Budget history
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Active and archived monthly budgets remain available for
                    review.
                </p>
            </div>
            <div
                role="region"
                tabIndex={0}
                aria-labelledby="budget-history-caption"
                className="hidden overflow-x-auto rounded-lg border border-border md:block"
            >
                <table className="w-full min-w-[54rem] text-left text-sm">
                    <caption id="budget-history-caption" className="sr-only">
                        Monthly budgets with periods, spending, utilization, and
                        actions
                    </caption>
                    <thead className="bg-elevated/40 border-b border-border text-xs text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-4 py-3">
                                Budget
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Period
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Status
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Allocated
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Actual
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Remaining
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {budgets.map((budget) => {
                            const remaining = signedRemaining(
                                budget.progress.remaining_amount,
                            );
                            const isSelected = selectedBudgetId === budget.id;
                            return (
                                <tr
                                    key={budget.id}
                                    className={
                                        isSelected
                                            ? 'bg-elevated/25'
                                            : undefined
                                    }
                                >
                                    <th
                                        scope="row"
                                        className="px-4 py-3 font-medium"
                                    >
                                        {budget.name}
                                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                            {budget.creator_name} ·{' '}
                                            {budget.progress.allocations.length}{' '}
                                            categories
                                        </span>
                                    </th>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {formatDateId(budget.period_start)} –{' '}
                                        {formatDateId(budget.period_end)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-wrap gap-1.5">
                                            <BudgetStatusBadge
                                                status={budget.status}
                                            />
                                            <BudgetWarningBadge
                                                warning={
                                                    budget.progress.warning
                                                }
                                                utilization={
                                                    budget.progress.utilization
                                                }
                                            />
                                        </div>
                                    </td>
                                    <td className="font-numeric px-4 py-3 text-right whitespace-nowrap">
                                        {formatIdr(budget.total_amount)}
                                    </td>
                                    <td className="font-numeric px-4 py-3 text-right whitespace-nowrap text-expense">
                                        {formatIdr(
                                            budget.progress.actual_amount,
                                        )}
                                    </td>
                                    <td
                                        className={`font-numeric px-4 py-3 text-right whitespace-nowrap ${remaining.className}`}
                                    >
                                        {remaining.text}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex gap-1">
                                            {onSelect && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-pressed={isSelected}
                                                    onClick={() =>
                                                        onSelect(budget)
                                                    }
                                                >
                                                    <Eye aria-hidden="true" />{' '}
                                                    {isSelected
                                                        ? 'Viewing'
                                                        : 'View'}
                                                </Button>
                                            )}
                                            {canManage && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        onEdit(budget)
                                                    }
                                                >
                                                    <Pencil aria-hidden="true" />{' '}
                                                    Edit
                                                </Button>
                                            )}
                                            {budget.can_archive &&
                                                budget.status === 'active' && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-warning"
                                                        onClick={() =>
                                                            onArchive(budget)
                                                        }
                                                    >
                                                        <Archive aria-hidden="true" />{' '}
                                                        Archive
                                                    </Button>
                                                )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <ul
                role="list"
                className="divide-y divide-border rounded-lg border border-border md:hidden"
            >
                {budgets.map((budget) => {
                    const remaining = signedRemaining(
                        budget.progress.remaining_amount,
                    );
                    const isSelected = selectedBudgetId === budget.id;
                    return (
                        <li key={budget.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-medium">
                                        {budget.name}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatDateId(budget.period_start)} –{' '}
                                        {formatDateId(budget.period_end)} ·{' '}
                                        {budget.creator_name}
                                    </p>
                                </div>
                                <BudgetStatusBadge status={budget.status} />
                            </div>
                            <div className="mt-3">
                                <BudgetWarningBadge
                                    warning={budget.progress.warning}
                                    utilization={budget.progress.utilization}
                                />
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Allocated
                                    </dt>
                                    <dd className="font-numeric mt-1 font-medium">
                                        {formatIdr(budget.total_amount)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Actual
                                    </dt>
                                    <dd className="font-numeric mt-1 font-medium text-expense">
                                        {formatIdr(
                                            budget.progress.actual_amount,
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Remaining
                                    </dt>
                                    <dd
                                        className={`font-numeric mt-1 font-medium ${remaining.className}`}
                                    >
                                        {remaining.text}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Categories
                                    </dt>
                                    <dd className="font-numeric mt-1 font-medium">
                                        {budget.progress.allocations.length}
                                    </dd>
                                </div>
                            </dl>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                {onSelect && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-pressed={isSelected}
                                        onClick={() => onSelect(budget)}
                                    >
                                        <Eye aria-hidden="true" />{' '}
                                        {isSelected ? 'Viewing' : 'View'}
                                    </Button>
                                )}
                                {canManage && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(budget)}
                                    >
                                        <Pencil aria-hidden="true" /> Edit
                                    </Button>
                                )}
                                {budget.can_archive &&
                                    budget.status === 'active' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-warning"
                                            onClick={() => onArchive(budget)}
                                        >
                                            <Archive aria-hidden="true" />{' '}
                                            Archive
                                        </Button>
                                    )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export function BudgetsSkeleton() {
    return (
        <div role="status" aria-label="Loading budgets" className="space-y-3">
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
    );
}
