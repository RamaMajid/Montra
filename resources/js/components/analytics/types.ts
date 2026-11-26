import type {
    AccountDistributionItem,
    BudgetItem,
    DashboardFilters,
    ExpenseBreakdownItem,
    RecentTransaction,
    Summary,
    TrendPoint,
} from '@/components/dashboard/types';

export type CategoryTrend = {
    category_id: number;
    name: string;
    color: string | null;
    icon: string | null;
    intervals: { date: string; amount: string }[];
};

export type SavingsRateTrend = {
    date: string;
    label: string;
    savings_rate: string | null;
};

export type AnalyticsProps = {
    period: {
        type: 'current_month' | 'previous_month' | 'custom';
        start_date: string;
        end_date: string;
    };
    summary: Summary;
    trends: TrendPoint[];
    category_trends: CategoryTrend[];
    savings_rate_trends: SavingsRateTrend[];
    expense_breakdown: ExpenseBreakdownItem[];
    account_distribution: AccountDistributionItem[];
    budget: BudgetItem[];
    recent_transactions: RecentTransaction[];
    filters: DashboardFilters;
};
