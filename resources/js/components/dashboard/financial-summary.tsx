import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
    formatIdr,
    formatPercent,
    formatSignedIdr,
} from '@/lib/format-currency';
import type { Summary } from './types';

type Tone = 'neutral' | 'income' | 'expense';

const toneClass: Record<Tone, string> = {
    neutral: 'text-foreground',
    income: 'text-income',
    expense: 'text-expense',
};

function Delta({
    change,
    percentage,
    increaseIsGood,
}: {
    change: string;
    percentage: string | null;
    increaseIsGood: boolean;
}) {
    const value = BigInt(change);
    const up = value > 0n;
    const flat = value === 0n;
    const good = flat ? null : up === increaseIsGood;
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

    return (
        <p
            className={cn(
                'mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground',
            )}
        >
            <Icon
                aria-hidden="true"
                className={cn(
                    'size-3.5',
                    good === true && 'text-income',
                    good === false && 'text-expense',
                )}
            />
            <span className="font-numeric font-medium text-foreground">
                {formatSignedIdr(change)}
            </span>
            {percentage !== null && (
                <span className="font-numeric">
                    ({formatPercent(percentage)})
                </span>
            )}
            <span>vs previous period</span>
        </p>
    );
}

function Metric({
    label,
    value,
    tone = 'neutral',
    children,
    primary = false,
}: {
    label: string;
    value: string;
    tone?: Tone;
    children?: ReactNode;
    primary?: boolean;
}) {
    return (
        <div
            className={cn(
                'min-w-0 rounded-lg border border-border bg-card p-5',
                primary && 'sm:col-span-2 lg:col-span-1 lg:row-span-1',
            )}
        >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'font-numeric mt-1.5 font-semibold tracking-tight break-all',
                    primary ? 'text-3xl' : 'text-2xl',
                    toneClass[tone],
                )}
                title={value}
            >
                {value}
            </dd>
            {children}
        </div>
    );
}

export function FinancialSummary({ summary }: { summary: Summary }) {
    const { comparison: c } = summary;

    return (
        <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="sr-only">
                Financial summary
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                    primary
                    label="Total balance"
                    value={formatIdr(summary.total_balance)}
                >
                    <p className="mt-2 text-xs text-muted-foreground">
                        Active accounts only
                    </p>
                </Metric>
                <Metric
                    label="Income"
                    tone="income"
                    value={formatIdr(summary.total_income)}
                >
                    {c && (
                        <Delta
                            change={c.income_change}
                            percentage={c.income_change_percentage}
                            increaseIsGood
                        />
                    )}
                </Metric>
                <Metric
                    label="Expense"
                    tone="expense"
                    value={formatIdr(summary.total_expense)}
                >
                    {c && (
                        <Delta
                            change={c.expense_change}
                            percentage={c.expense_change_percentage}
                            increaseIsGood={false}
                        />
                    )}
                </Metric>
                <Metric
                    label="Net cash flow"
                    tone={
                        BigInt(summary.net_cash_flow) < 0n
                            ? 'expense'
                            : 'income'
                    }
                    value={formatIdr(summary.net_cash_flow)}
                >
                    {c && (
                        <Delta
                            change={c.net_cash_flow_change}
                            percentage={null}
                            increaseIsGood
                        />
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                        Savings rate:{' '}
                        <span className="font-numeric font-medium text-foreground">
                            {summary.savings_rate === null
                                ? 'Unavailable (no income)'
                                : formatPercent(summary.savings_rate)}
                        </span>
                    </p>
                </Metric>
            </dl>
        </section>
    );
}
