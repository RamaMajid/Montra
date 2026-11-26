export type BudgetWarning = 'on_track' | 'warning' | 'critical' | 'exceeded';

export type BudgetStatus = 'active' | 'archived';

export type BudgetAllocationItem = {
    category_id: number;
    category_name: string;
    category_active: boolean;
    allocated_amount: string;
    actual_amount: string;
    remaining_amount: string;
    utilization: string | null;
    warning: BudgetWarning;
};

export type BudgetProgress = {
    actual_amount: string;
    remaining_amount: string;
    utilization: string | null;
    warning: BudgetWarning;
    allocations: BudgetAllocationItem[];
};

export type BudgetItem = {
    id: number;
    name: string;
    period_start: string;
    period_end: string;
    total_amount: string;
    status: BudgetStatus;
    created_by: number;
    creator_name: string;
    can_archive: boolean;
    progress: BudgetProgress;
};

export type BudgetCategoryOption = {
    id: number;
    name: string;
    is_active?: boolean;
};

export type BudgetsIndexProps = {
    budgets?: BudgetItem[];
    categories?: BudgetCategoryOption[];
    canManage?: boolean;
};

export type BudgetStatusFilter = 'all' | BudgetStatus;
