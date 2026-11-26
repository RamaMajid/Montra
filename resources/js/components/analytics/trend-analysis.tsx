import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatIdr, formatPercent, ratio } from '@/lib/format-currency';
import type { TrendPoint } from '@/components/dashboard/types';
import type { SavingsRateTrend } from './types';

function maxAmount(trends: TrendPoint[]): string {
    return trends
        .flatMap((point) => [BigInt(point.income), BigInt(point.expense)])
        .reduce((max, value) => (value > max ? value : max), 0n)
        .toString();
}

export function TrendAnalysis({
    trends,
    savingsRates,
}: {
    trends: TrendPoint[];
    savingsRates: SavingsRateTrend[];
}) {
    const max = maxAmount(trends);
    const hasData = max !== '0';

    if (!hasData) {
        return (
            <EmptyState
                icon={BarChart3}
                title="No income or expenses in this period"
                description="Choose another period or record transactions to view trends."
            />
        );
    }

    return (
        <section
            aria-labelledby="trend-analysis-heading"
            className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6 lg:col-span-2"
        >
            <header>
                <h2
                    id="trend-analysis-heading"
                    className="text-base font-semibold tracking-tight"
                >
                    Cash flow over time
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Income and expenses by transaction date. Transfers are
                    excluded.
                </p>
            </header>
            <ul
                role="list"
                className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"
            >
                <li className="flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="size-2.5 rounded-sm bg-income"
                    />
                    Income
                </li>
                <li className="flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="size-2.5 rounded-sm bg-expense"
                    />
                    Expense
                </li>
            </ul>
            <figure className="mt-5" aria-describedby="trend-analysis-caption">
                <div
                    role="img"
                    aria-label={`Bar chart of income and expense across ${trends.length} periods. Data table available below.`}
                    className="flex h-60 items-end gap-px border-b border-border"
                >
                    {trends.map((point) => (
                        <div
                            key={point.date}
                            title={`${point.label}: income ${formatIdr(point.income)}, expense ${formatIdr(point.expense)}`}
                            className="flex h-full min-w-0 flex-1 items-end justify-center gap-px"
                        >
                            <span
                                aria-hidden="true"
                                className="w-1/2 max-w-4 rounded-t-sm bg-income"
                                style={{
                                    height: `${ratio(point.income, max) * 100}%`,
                                }}
                            />
                            <span
                                aria-hidden="true"
                                className="w-1/2 max-w-4 rounded-t-sm bg-expense"
                                style={{
                                    height: `${ratio(point.expense, max) * 100}%`,
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div
                    aria-hidden="true"
                    className="mt-2 flex gap-px text-[0.625rem] text-muted-foreground"
                >
                    {trends.map((point, index) => (
                        <span
                            key={point.date}
                            className="min-w-0 flex-1 truncate text-center"
                        >
                            {index %
                                Math.max(1, Math.ceil(trends.length / 8)) ===
                            0
                                ? point.label
                                : ''}
                        </span>
                    ))}
                </div>
                <figcaption
                    id="trend-analysis-caption"
                    className="mt-3 text-xs text-muted-foreground"
                >
                    Savings rate is shown in table. A dash means income was zero
                    for that period.
                </figcaption>
            </figure>
            <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">
                    View data table
                </summary>
                <div
                    tabIndex={0}
                    role="region"
                    aria-labelledby="trend-data-caption"
                    className="mt-3 max-h-80 overflow-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <table className="w-full min-w-[36rem] text-left text-xs">
                        <caption id="trend-data-caption" className="sr-only">
                            Income, expense, net cash flow, and savings rate by
                            period
                        </caption>
                        <thead className="bg-elevated sticky top-0">
                            <tr>
                                <th scope="col" className="p-3">
                                    Period
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Income
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Expense
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Net
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Savings rate
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {trends.map((point, index) => (
                                <tr
                                    key={point.date}
                                    className="border-t border-border"
                                >
                                    <th scope="row" className="p-3 font-medium">
                                        {point.label}
                                    </th>
                                    <td className="font-numeric p-3 text-right text-income">
                                        {formatIdr(point.income)}
                                    </td>
                                    <td className="font-numeric p-3 text-right text-expense">
                                        {formatIdr(point.expense)}
                                    </td>
                                    <td className="font-numeric p-3 text-right">
                                        {formatIdr(point.net)}
                                    </td>
                                    <td className="font-numeric p-3 text-right">
                                        {formatPercent(
                                            savingsRates[index]?.savings_rate,
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </section>
    );
}
