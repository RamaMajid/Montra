import { Target } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatDateId, formatIdr, formatPercent } from '@/lib/format-currency';
import { barWidth } from './expense-breakdown';
import { DashboardSection } from './dashboard-section';
import type { BudgetItem, BudgetWarning } from './types';

export const warningStyle: Record<
    BudgetWarning,
    { label: string; bar: string; text: string }
> = {
    on_track: { label: 'On track', bar: 'bg-income', text: 'text-income' },
    warning: {
        label: 'Approaching limit',
        bar: 'bg-warning',
        text: 'text-warning',
    },
    critical: { label: 'Critical', bar: 'bg-expense', text: 'text-expense' },
    exceeded: { label: 'Exceeded', bar: 'bg-expense', text: 'text-expense' },
};

export function BudgetOverview({ budgets }: { budgets: BudgetItem[] }) {
    return (
        <DashboardSection
            id="budget-heading"
            title="Budget progress"
            description="Active budgets overlapping this period, measured over each budget's full dates."
        >
            {budgets.length === 0 ? (
                <EmptyState
                    icon={Target}
                    title="No active budgets"
                    description="No budget overlaps the selected period."
                />
            ) : (
                <ul className="space-y-5">
                    {budgets.map((budget) => {
                        const style = warningStyle[budget.warning];

                        return (
                            <li key={budget.budget_id}>
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="min-w-0">
                                        <span
                                            className="block truncate text-sm font-medium"
                                            title={budget.name}
                                        >
                                            {budget.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDateId(budget.period_start)}{' '}
                                            – {formatDateId(budget.period_end)}
                                        </span>
                                    </span>
                                    <span
                                        className={`shrink-0 text-xs font-medium ${style.text}`}
                                    >
                                        {style.label} ·{' '}
                                        <span className="font-numeric">
                                            {formatPercent(budget.utilization)}
                                        </span>
                                    </span>
                                </div>
                                <div
                                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                                    role="progressbar"
                                    aria-label={`${budget.name} utilization`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.min(
                                        100,
                                        Number.parseFloat(
                                            budget.utilization ?? '0',
                                        ) || 0,
                                    )}
                                    aria-valuetext={`${formatPercent(budget.utilization)}, ${style.label}`}
                                >
                                    <div
                                        className={`h-full rounded-full ${style.bar}`}
                                        style={{
                                            width: barWidth(budget.utilization),
                                        }}
                                    />
                                </div>
                                <p className="font-numeric mt-2 text-xs text-muted-foreground">
                                    {formatIdr(budget.actual_amount)} of{' '}
                                    {formatIdr(budget.total_amount)} ·{' '}
                                    {BigInt(budget.remaining_amount) < 0n
                                        ? `${formatIdr(budget.remaining_amount.replace('-', ''))} over`
                                        : `${formatIdr(budget.remaining_amount)} left`}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            )}
        </DashboardSection>
    );
}
