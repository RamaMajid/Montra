import { Link } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    Receipt,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatDateId, formatIdr } from '@/lib/format-currency';
import { DashboardSection } from './dashboard-section';
import type { RecentTransaction } from './types';

const typeMeta = {
    income: {
        label: 'Income',
        Icon: ArrowDownLeft,
        text: 'text-income',
        sign: '+',
    },
    expense: {
        label: 'Expense',
        Icon: ArrowUpRight,
        text: 'text-expense',
        sign: '-',
    },
    transfer: {
        label: 'Transfer',
        Icon: ArrowLeftRight,
        text: 'text-transfer',
        sign: '',
    },
} as const;

function subtitle(tx: RecentTransaction): string {
    if (tx.type === 'transfer') {
        return `${tx.source_account?.name ?? '—'} → ${tx.destination_account?.name ?? '—'}`;
    }

    return [tx.category?.name, tx.account?.name].filter(Boolean).join(' · ');
}

export function RecentTransactions({
    transactions,
}: {
    transactions: RecentTransaction[];
}) {
    return (
        <DashboardSection
            id="recent-heading"
            title="Recent transactions"
            description="Your five newest records."
            className="lg:col-span-2"
        >
            {transactions.length === 0 ? (
                <EmptyState
                    icon={Receipt}
                    title="No transactions yet"
                    description="Add a transaction to start tracking."
                    action={
                        <Link
                            href="/transactions"
                            className="text-sm font-medium text-primary underline underline-offset-4"
                        >
                            Go to transactions
                        </Link>
                    }
                />
            ) : (
                <>
                    <ul className="divide-y divide-border">
                        {transactions.map((tx) => {
                            const meta = typeMeta[tx.type];

                            return (
                                <li
                                    key={tx.id}
                                    className="flex items-center gap-3 py-3 first:pt-0"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <meta.Icon
                                            aria-hidden="true"
                                            className={`size-4 ${meta.text}`}
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className="block truncate text-sm font-medium"
                                            title={tx.description ?? undefined}
                                        >
                                            {tx.description || meta.label}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {formatDateId(tx.transaction_date)}
                                            {subtitle(tx) &&
                                                ` · ${subtitle(tx)}`}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span
                                            className={`font-numeric block text-sm font-semibold ${meta.text}`}
                                        >
                                            {meta.sign}
                                            {formatIdr(tx.amount)}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {meta.label}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <Link
                        href="/transactions"
                        className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
                    >
                        View all transactions
                    </Link>
                </>
            )}
        </DashboardSection>
    );
}
