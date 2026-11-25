// Mirrors docs/07-dashboard-analytics-contract.md. Money and percentages are decimal strings.
export type PeriodType = 'current_month' | 'previous_month' | 'custom';

export type DashboardFilters = {
    period?: PeriodType | null;
    date_from?: string | null;
    date_to?: string | null;
};

export type TrendPoint = {
    date: string;
    label: string;
    income: string;
    expense: string;
    net: string;
};

export type Comparison = {
    previous_start: string;
    previous_end: string;
    income_change: string;
    income_change_percentage: string | null;
    expense_change: string;
    expense_change_percentage: string | null;
    net_cash_flow_change: string;
};

export type Summary = {
    total_balance: string;
    total_income: string;
    total_expense: string;
    net_cash_flow: string;
    savings_rate: string | null;
    transaction_counts: { income: number; expense: number; transfer: number };
    comparison?: Comparison | null;
};

export type ExpenseBreakdownItem = {
    category_id: number;
    name: string;
    color: string | null;
    amount: string;
    percentage: string | null;
};

export type AccountDistributionItem = {
    id: number;
    name: string;
    type: string;
    color: string | null;
    balance: string;
    percentage: string | null;
};

export type BudgetWarning = 'on_track' | 'warning' | 'critical' | 'exceeded';

export type BudgetItem = {
    budget_id: number;
    name: string;
    period_start: string;
    period_end: string;
    total_amount: string;
    actual_amount: string;
    remaining_amount: string;
    utilization: string | null;
    warning: BudgetWarning;
};

type RelatedEntity = { id: number; name: string } | null;

export type RecentTransaction = {
    id: number;
    type: 'income' | 'expense' | 'transfer';
    description: string | null;
    amount: string;
    transaction_date: string;
    account: RelatedEntity;
    source_account: RelatedEntity;
    destination_account: RelatedEntity;
    category: RelatedEntity;
};

export type DashboardProps = {
    period: { type: PeriodType; start_date: string; end_date: string };
    summary: Summary;
    trends: TrendPoint[];
    expense_breakdown: ExpenseBreakdownItem[];
    account_distribution: AccountDistributionItem[];
    budget: BudgetItem[];
    recent_transactions: RecentTransaction[];
    filters?: DashboardFilters | unknown[];
};
