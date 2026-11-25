import { LineChart } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatIdr, ratio } from '@/lib/format-currency';
import { DashboardSection } from './dashboard-section';
import type { TrendPoint } from './types';

function maxAmount(points: TrendPoint[]): string {
    return points
        .flatMap((point) => [BigInt(point.income), BigInt(point.expense)])
        .reduce((max, value) => (value > max ? value : max), 0n)
        .toString();
}

export function FinancialTrendChart({ trends }: { trends: TrendPoint[] }) {
    const max = maxAmount(trends);
    const hasActivity = max !== '0';
    // Every other label when dense, to avoid overlap on narrow screens.
    const step = trends.length > 16 ? Math.ceil(trends.length / 8) : 1;

    return (
        <DashboardSection
            id="trend-heading"
            title="Income vs expense"
            description="Totals per day or month, calculated by the server. Transfers are excluded."
            className="lg:col-span-2"
        >
            {!hasActivity ? (
                <EmptyState
                    icon={LineChart}
                    title="No income or expense in this period"
                    description="Record transactions in this date range to see the trend."
                />
            ) : (
                <>
                    <ul
                        className="mb-4 flex gap-4 text-xs text-muted-foreground"
                        aria-label="Legend"
                    >
                        <li className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-[2px] bg-income" />
                            Income
                        </li>
                        <li className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-[2px] border border-expense bg-expense/40" />
                            Expense
                        </li>
                    </ul>
                    <div
                        className="flex h-56 items-end gap-1 border-b border-border"
                        role="img"
                        aria-label={`Bar chart of income and expense across ${trends.length} intervals. Full data is in the table below.`}
                    >
                        {trends.map((point) => (
                            <div
                                key={point.date}
                                className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
                                title={`${point.label}: income ${formatIdr(point.income)}, expense ${formatIdr(point.expense)}`}
                            >
                                <span
                                    className="w-1/2 max-w-3 rounded-t-[2px] bg-income"
                                    style={{
                                        height: `${ratio(point.income, max) * 100}%`,
                                    }}
                                />
                                <span
                                    className="w-1/2 max-w-3 rounded-t-[2px] border border-b-0 border-expense bg-expense/40"
                                    style={{
                                        height: `${ratio(point.expense, max) * 100}%`,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div
                        className="mt-2 flex gap-1 text-[0.6875rem] text-muted-foreground"
                        aria-hidden="true"
                    >
                        {trends.map((point, index) => (
                            <span
                                key={point.date}
                                className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
                            >
                                {index % step === 0 ? point.label : ''}
                            </span>
                        ))}
                    </div>
                    <details className="mt-4 text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View data table
                        </summary>
                        <div
                            tabIndex={0}
                            role="region"
                            aria-label="Income and expense data"
                            className="mt-3 max-h-64 overflow-auto rounded-md border border-border focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <table className="w-full text-left text-xs">
                                <thead className="sticky top-0 bg-surface-elevated">
                                    <tr>
                                        <th scope="col" className="p-2">
                                            Period
                                        </th>
                                        <th
                                            scope="col"
                                            className="p-2 text-right"
                                        >
                                            Income
                                        </th>
                                        <th
                                            scope="col"
                                            className="p-2 text-right"
                                        >
                                            Expense
                                        </th>
                                        <th
                                            scope="col"
                                            className="p-2 text-right"
                                        >
                                            Net
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trends.map((point) => (
                                        <tr
                                            key={point.date}
                                            className="border-t border-border"
                                        >
                                            <th
                                                scope="row"
                                                className="p-2 font-normal"
                                            >
                                                {point.label}
                                            </th>
                                            <td className="font-numeric p-2 text-right text-income">
                                                {formatIdr(point.income)}
                                            </td>
                                            <td className="font-numeric p-2 text-right text-expense">
                                                {formatIdr(point.expense)}
                                            </td>
                                            <td className="font-numeric p-2 text-right">
                                                {formatIdr(point.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </>
            )}
        </DashboardSection>
    );
}
