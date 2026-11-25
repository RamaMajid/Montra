export type AccountType = 'bank' | 'e_wallet' | 'cash' | 'savings' | 'other';

export type AccountItem = {
    id: number;
    name: string;
    type: AccountType;
    initial_balance: string;
    current_balance: string;
    institution: string | null;
    description: string | null;
    color: string | null;
    icon: string | null;
    is_active: boolean;
};

export type AccountsProps = {
    accounts: AccountItem[];
    canManage: boolean;
};

export const accountTypeLabels: Record<AccountType, string> = {
    bank: 'Bank',
    e_wallet: 'E-wallet',
    cash: 'Cash',
    savings: 'Savings',
    other: 'Other',
};

export const accountTypes: Array<{ value: AccountType; label: string }> = [
    { value: 'bank', label: 'Bank' },
    { value: 'e_wallet', label: 'E-wallet' },
    { value: 'cash', label: 'Cash' },
    { value: 'savings', label: 'Savings' },
    { value: 'other', label: 'Other' },
];
