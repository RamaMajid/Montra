import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { AnalyticsPeriodFilter } from '@/components/analytics/analytics-period-filter';
import { CategoryTrends } from '@/components/analytics/category-trends';
import { TrendAnalysis } from '@/components/analytics/trend-analysis';
import type { AnalyticsProps } from '@/components/analytics/types';
import { AccountDistribution } from '@/components/dashboard/account-distribution';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import { ExpenseBreakdown } from '@/components/dashboard/expense-breakdown';
import { FinancialSummary } from '@/components/dashboard/financial-summary';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateId } from '@/lib/format-currency';
import analytics from '@/routes/analytics';

export function AnalyticsSkeleton() {
    return (
        <div
            aria-label="Loading analytics"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
    );
}

export default function AnalyticsIndex({
    period,
    summary,
    trends,
    category_trends,
    savings_rate_trends,
    expense_breakdown,
    account_distribution,
    budget,
    recent_transactions,
}: AnalyticsProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <>
            <Head title="Analytics" />
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Insights & reports"
                    title="Analytics"
                    description={`${formatDateId(period.start_date)} – ${formatDateId(period.end_date)}. Income: ${summary.transaction_counts.income}, expense: ${summary.transaction_counts.expense}, transfer: ${summary.transaction_counts.transfer}.`}
                    actions={
                        <AnalyticsPeriodFilter
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
                    <AlertError title="Analytics error" errors={[error]} />
                )}
                {loading && <AnalyticsSkeleton />}
                <div
                    aria-busy={loading}
                    className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-50' : ''}`}
                >
                    <FinancialSummary summary={summary} />
                    <div className="grid gap-6 lg:grid-cols-3">
                        <TrendAnalysis
                            trends={trends}
                            savingsRates={savings_rate_trends}
                        />
                        <ExpenseBreakdown items={expense_breakdown} />
                        <CategoryTrends items={category_trends} />
                        <AccountDistribution items={account_distribution} />
                        <BudgetOverview budgets={budget} />
                        <RecentTransactions
                            transactions={recent_transactions}
                        />
                    </div>
                </div>
                <p role="status" className="sr-only">
                    {loading ? 'Updating analytics' : ''}
                </p>
            </div>
        </>
    );
}

AnalyticsIndex.layout = {
    breadcrumbs: [{ title: 'Analytics', href: analytics.page.url() }],
};
