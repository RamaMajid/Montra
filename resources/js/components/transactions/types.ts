export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionAccount = {
    id: number;
    name: string;
    type: string;
    color: string | null;
    icon: string | null;
    is_active: boolean;
};

export type TransactionCategory = Omit<TransactionAccount, 'type'> & {
    type: 'income' | 'expense';
};

export type TransactionItem = {
    id: number;
    type: TransactionType;
    description: string;
    amount: string;
    transaction_date: string;
    notes: string | null;
    source: string;
    created_by: number;
    creator_name: string | null;
    account: TransactionAccount | null;
    source_account: TransactionAccount | null;
    destination_account: TransactionAccount | null;
    category: TransactionCategory | null;
    can_edit: boolean;
    can_delete: boolean;
};

export type PaginatedTransactions = {
    data: TransactionItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

export type TransactionFilters = {
    type: string;
    account_id: string;
    category_id: string;
    date_from: string;
    date_to: string;
    search: string;
    sort: string;
};
