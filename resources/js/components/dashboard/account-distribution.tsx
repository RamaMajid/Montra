import { Wallet } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { formatIdr, formatPercent } from '@/lib/format-currency';
import { barWidth } from './expense-breakdown';
import { DashboardSection } from './dashboard-section';
import type { AccountDistributionItem } from './types';

const typeLabels: Record<string, string> = {
    bank: 'Bank',
    e_wallet: 'E-wallet',
    cash: 'Cash',
    savings: 'Savings',
    other: 'Other',
};

export function AccountDistribution({
    items,
}: {
    items: AccountDistributionItem[];
}) {
    return (
        <DashboardSection
            id="accounts-heading"
            title="Accounts"
            description="Current balance of active accounts."
        >
            {items.length === 0 ? (
                <EmptyState
                    icon={Wallet}
                    title="No active accounts"
                    description="Add an account to see its balance here."
                />
            ) : (
                <ul className="space-y-4">
                    {items.map((account) => (
                        <li key={account.id}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0">
                                    <span
                                        className="block truncate font-medium"
                                        title={account.name}
                                    >
                                        {account.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {typeLabels[account.type] ??
                                            account.type}
                                    </span>
                                </span>
                                <span
                                    className={`font-numeric shrink-0 font-medium ${BigInt(account.balance) < 0n ? 'text-expense' : ''}`}
                                >
                                    {formatIdr(account.balance)}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {formatPercent(account.percentage)}
                                    </span>
                                </span>
                            </div>
                            <div
                                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                                role="presentation"
                            >
                                <div
                                    className="h-full rounded-full bg-primary"
                                    style={{
                                        width: barWidth(account.percentage),
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </DashboardSection>
    );
}
