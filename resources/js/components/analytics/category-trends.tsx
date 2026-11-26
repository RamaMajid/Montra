import { BarChart3 } from 'lucide-react';
import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { EmptyState } from '@/components/empty-state';
import {
    formatDateId,
    formatIdr,
    formatMonthId,
    ratio,
} from '@/lib/format-currency';
import type { CategoryTrend } from './types';

export function CategoryTrends({ items }: { items: CategoryTrend[] }) {
    const max = items
        .flatMap((item) => item.intervals)
        .reduce(
            (value, point) =>
                BigInt(point.amount) > value ? BigInt(point.amount) : value,
            0n,
        )
        .toString();
    return (
        <DashboardSection
            id="category-trends-heading"
            title="Category trends"
            description="Compare expense categories on one shared scale. Each series keeps the server's daily or monthly intervals."
        >
            {items.length === 0 ? (
                <EmptyState
                    icon={BarChart3}
                    title="No category trends"
                    description="Choose a period with expenses to compare categories."
                />
            ) : (
                <div className="space-y-6">
                    {items.map((item) => (
                        <div key={item.category_id} className="min-w-0">
                            <h3 className="text-sm font-medium break-words">
                                {item.name}
                            </h3>
                            <div
                                role="img"
                                aria-label={`${item.name} expense trend across ${item.intervals.length} periods. Values follow in the table.`}
                                className="mt-2 flex h-20 items-end gap-px border-b border-border"
                            >
                                {item.intervals.map((point) => (
                                    <span
                                        key={point.date}
                                        aria-hidden="true"
                                        title={`${point.date.length === 7 ? formatMonthId(point.date) : formatDateId(point.date)}: ${formatIdr(point.amount)}`}
                                        className="min-w-0 flex-1 bg-primary"
                                        style={{
                                            height: `${ratio(point.amount, max) * 100}%`,
                                        }}
                                    />
                                ))}
                            </div>
                            <details className="mt-2">
                                <summary className="cursor-pointer py-2 text-sm text-primary">
                                    View {item.name} values
                                </summary>
                                <div
                                    tabIndex={0}
                                    role="region"
                                    aria-label={`${item.name} expense history`}
                                    className="max-h-64 overflow-auto focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                    <table className="w-full text-left text-sm">
                                        <caption className="sr-only">
                                            {item.name} expense by interval
                                        </caption>
                                        <thead className="sticky top-0 bg-card">
                                            <tr>
                                                <th scope="col" className="p-2">
                                                    Period
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="p-2 text-right"
                                                >
                                                    Expense
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.intervals.map((point) => (
                                                <tr
                                                    key={point.date}
                                                    className="border-t border-border"
                                                >
                                                    <th
                                                        scope="row"
                                                        className="p-2 font-normal"
                                                    >
                                                        {point.date.length === 7
                                                            ? formatMonthId(
                                                                  point.date,
                                                              )
                                                            : formatDateId(
                                                                  point.date,
                                                              )}
                                                    </th>
                                                    <td className="font-numeric p-2 text-right break-all">
                                                        {formatIdr(
                                                            point.amount,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            )}
        </DashboardSection>
    );
}
