import { PieChart } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatIdr, formatPercent } from '@/lib/format-currency';
import { DashboardSection } from './dashboard-section';
import type { ExpenseBreakdownItem } from './types';

// Server-supplied percentage as a bar width; visual only.
export function barWidth(percentage: string | null): string {
    const value = Number.parseFloat(percentage ?? '0');

    return `${Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))}%`;
}

export function ExpenseBreakdown({ items }: { items: ExpenseBreakdownItem[] }) {
    return (
        <DashboardSection
            id="expense-heading"
            title="Where your money went"
            description="Expense by category, largest first."
        >
            {items.length === 0 ? (
                <EmptyState
                    icon={PieChart}
                    title="No expenses in this period"
                    description="Categorised spending will appear here."
                />
            ) : (
                <ol className="space-y-4">
                    {items.map((item) => (
                        <li key={item.category_id}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-2.5 shrink-0 rounded-full bg-expense"
                                        style={
                                            item.color
                                                ? {
                                                      backgroundColor:
                                                          item.color,
                                                  }
                                                : undefined
                                        }
                                    />
                                    <span
                                        className="truncate"
                                        title={item.name}
                                    >
                                        {item.name}
                                    </span>
                                </span>
                                <span className="font-numeric shrink-0 font-medium">
                                    {formatIdr(item.amount)}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {formatPercent(item.percentage)}
                                    </span>
                                </span>
                            </div>
                            <div
                                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                                role="presentation"
                            >
                                <div
                                    className="h-full rounded-full bg-expense/70"
                                    style={{ width: barWidth(item.percentage) }}
                                />
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </DashboardSection>
    );
}
