export type CategoryType = 'income' | 'expense';

export type CategoryItem = {
    id: number;
    name: string;
    type: CategoryType;
    description: string | null;
    color: string | null;
    icon: string | null;
    is_default: boolean;
    is_active: boolean;
};

export type CategoriesProps = {
    categories: CategoryItem[];
    canManage: boolean;
};

export const categoryTypeLabels: Record<CategoryType, string> = {
    income: 'Income',
    expense: 'Expense',
};
