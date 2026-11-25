import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { AccountDistribution } from '@/components/dashboard/account-distribution';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import { DashboardPeriodFilter } from '@/components/dashboard/dashboard-period-filter';
import { ExpenseBreakdown } from '@/components/dashboard/expense-breakdown';
import { FinancialSummary } from '@/components/dashboard/financial-summary';
import { FinancialTrendChart } from '@/components/dashboard/financial-trend-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import type { DashboardProps } from '@/components/dashboard/types';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateId } from '@/lib/format-currency';
import { dashboard } from '@/routes';

export function DashboardSkeleton() {
    return (
        <div
            aria-label="Loading dashboard"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
    );
}

export default function Dashboard({
    period,
    summary,
    trends,
    expense_breakdown,
    account_distribution,
    budget,
    recent_transactions,
}: DashboardProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <>
            <Head title="Dashboard" />
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Overview"
                    title="Dashboard"
                    description={`${formatDateId(period.start_date)} – ${formatDateId(period.end_date)}. Figures are calculated by the server from your transaction dates.`}
                    actions={
                        <DashboardPeriodFilter
                            key={`${period.type}-${period.start_date}-${period.end_date}`}
                            period={period.type}
                            startDate={period.start_date}
                            endDate={period.end_date}
                            onLoadingChange={setLoading}
                            onErrorChange={setError}
                        />
                    }
                />
                {error && (
                    <AlertError title="Dashboard error" errors={[error]} />
                )}
                {loading && <DashboardSkeleton />}
                <div
                    aria-busy={loading}
                    className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-50' : ''}`}
                >
                    <FinancialSummary summary={summary} />
                    <div className="grid gap-6 lg:grid-cols-3">
                        <FinancialTrendChart trends={trends} />
                        <ExpenseBreakdown items={expense_breakdown} />
                        <RecentTransactions
                            transactions={recent_transactions}
                        />
                        <AccountDistribution items={account_distribution} />
                        <BudgetOverview budgets={budget} />
                    </div>
                </div>
                <p role="status" className="sr-only">
                    {loading ? 'Updating dashboard' : ''}
                </p>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
