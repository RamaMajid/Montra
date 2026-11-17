import { useState } from 'react';
import { Form, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { formatIdr } from '@/lib/format-currency';
import {
    ArrowDownRight,
    ArrowLeftRight,
    ArrowUpRight,
    Calendar,
    Filter,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';

export type TransactionAccount = {
    id: number;
    name: string;
    type: string;
    color: string | null;
    icon: string | null;
    is_active: boolean;
};

export type TransactionCategory = {
    id: number;
    name: string;
    type: 'income' | 'expense';
    color: string | null;
    icon: string | null;
    is_active: boolean;
};

export type TransactionItem = {
    id: number;
    type: 'income' | 'expense' | 'transfer';
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
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
};

type Props = {
    transactions: PaginatedTransactions;
    accounts: TransactionAccount[];
    categories: TransactionCategory[];
    filters: {
        type: string;
        account_id: string;
        category_id: string;
        date_from: string;
        date_to: string;
        search: string;
        sort: string;
    };
    canCreate: boolean;
};

export default function TransactionsIndex({
    transactions,
    accounts,
    categories,
    filters,
    canCreate,
}: Props) {
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<TransactionItem | null>(null);
    const [detailItem, setDetailItem] = useState<TransactionItem | null>(null);

    // Filter states
    const [typeFilter, setTypeFilter] = useState(filters.type || '');
    const [accountFilter, setAccountFilter] = useState(
        filters.account_id || '',
    );
    const [categoryFilter, setCategoryFilter] = useState(
        filters.category_id || '',
    );
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [sortBy, setSortBy] = useState(filters.sort || 'date_desc');
    const [showFilters, setShowFilters] = useState(
        Boolean(
            filters.type ||
            filters.account_id ||
            filters.category_id ||
            filters.date_from ||
            filters.date_to ||
            filters.search,
        ),
    );

    // Form states
    const [formType, setFormType] = useState<'income' | 'expense' | 'transfer'>(
        'expense',
    );
    const [formAmount, setFormAmount] = useState('');
    const [sourceAccId, setSourceAccId] = useState<string>('');

    const today = new Date().toISOString().split('T')[0];

    const applyFilters = () => {
        router.get(
            '/transactions',
            {
                type: typeFilter || undefined,
                account_id: accountFilter || undefined,
                category_id: categoryFilter || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                search: searchTerm || undefined,
                sort: sortBy !== 'date_desc' ? sortBy : undefined,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const clearFilters = () => {
        setTypeFilter('');
        setAccountFilter('');
        setCategoryFilter('');
        setDateFrom('');
        setDateTo('');
        setSearchTerm('');
        setSortBy('date_desc');
        router.get('/transactions', {}, { preserveState: true });
    };

    const startCreate = (
        type: 'income' | 'expense' | 'transfer' = 'expense',
    ) => {
        setEditing(null);
        setFormType(type);
        setFormAmount('');
        setSourceAccId('');
        setIsCreating(true);
    };

    const startEdit = (tx: TransactionItem) => {
        setIsCreating(false);
        setEditing(tx);
        setFormType(tx.type);
        setFormAmount(tx.amount);
        setSourceAccId(tx.source_account ? String(tx.source_account.id) : '');
    };

    // Account list for form: active accounts plus existing transaction reference if archived
    const getAccountOptions = (currentSelectedId?: number | null) => {
        return accounts.filter(
            (acc) =>
                acc.is_active ||
                (currentSelectedId && acc.id === currentSelectedId),
        );
    };

    // Category list for form: active matching categories plus existing transaction reference if archived
    const getCategoryOptions = (
        type: 'income' | 'expense',
        currentSelectedId?: number | null,
    ) => {
        return categories.filter(
            (cat) =>
                cat.type === type &&
                (cat.is_active ||
                    (currentSelectedId && cat.id === currentSelectedId)),
        );
    };

    const previewFormattedAmount = (amt: string) => {
        if (!amt || !/^[1-9][0-9]*$/.test(amt)) return null;
        try {
            return formatIdr(amt);
        } catch {
            return null;
        }
    };

    return (
        <AppLayout
            breadcrumbs={[{ title: 'Transactions', href: '/transactions' }]}
        >
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
                {/* Header */}
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-emerald-500">
                            Workspace
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Transactions
                        </h1>
                    </div>
                    {canCreate && !isCreating && !editing && (
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => startCreate('expense')}
                                className="bg-emerald-700 text-white hover:bg-emerald-800"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add
                                transaction
                            </Button>
                        </div>
                    )}
                </header>

                {/* Create / Edit Form Card */}
                {(isCreating || editing) && (
                    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-medium text-foreground">
                                    {editing
                                        ? `Edit Transaction: ${editing.description}`
                                        : 'New Transaction'}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {editing
                                        ? 'Update transaction details'
                                        : 'Record an income, expense, or transfer'}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditing(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Type Toggle */}
                        <div className="mb-6 flex max-w-md gap-2 rounded-lg bg-muted/60 p-1">
                            <button
                                type="button"
                                onClick={() => setFormType('expense')}
                                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                                    formType === 'expense'
                                        ? 'bg-background text-rose-500 shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormType('income')}
                                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                                    formType === 'income'
                                        ? 'bg-background text-emerald-500 shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Income
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormType('transfer')}
                                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                                    formType === 'transfer'
                                        ? 'bg-background text-sky-500 shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Transfer
                            </button>
                        </div>

                        <Form
                            action={
                                editing
                                    ? `/transactions/${editing.id}`
                                    : '/transactions'
                            }
                            method={editing ? 'put' : 'post'}
                            onSuccess={() => {
                                setIsCreating(false);
                                setEditing(null);
                            }}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <input
                                        type="hidden"
                                        name="type"
                                        value={formType}
                                    />

                                    {/* Description */}
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="tx-description">
                                            Description
                                        </Label>
                                        <Input
                                            id="tx-description"
                                            name="description"
                                            required
                                            defaultValue={
                                                editing?.description ?? ''
                                            }
                                            placeholder={
                                                formType === 'expense'
                                                    ? 'e.g. Grocery shopping'
                                                    : formType === 'income'
                                                      ? 'e.g. Monthly salary'
                                                      : 'e.g. Transfer to savings'
                                            }
                                        />
                                        <InputError
                                            message={errors.description}
                                        />
                                    </div>

                                    {/* Amount */}
                                    <div className="sm:col-span-1">
                                        <Label htmlFor="tx-amount">
                                            Amount (IDR)
                                        </Label>
                                        <Input
                                            id="tx-amount"
                                            name="amount"
                                            required
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[1-9][0-9]*"
                                            value={formAmount}
                                            onChange={(e) =>
                                                setFormAmount(
                                                    e.target.value.replace(
                                                        /\D/g,
                                                        '',
                                                    ),
                                                )
                                            }
                                            placeholder="e.g. 50000"
                                        />
                                        {previewFormattedAmount(formAmount) && (
                                            <p className="mt-1 text-xs font-medium text-emerald-500">
                                                {previewFormattedAmount(
                                                    formAmount,
                                                )}
                                            </p>
                                        )}
                                        <InputError message={errors.amount} />
                                    </div>

                                    {/* Transaction Date */}
                                    <div className="sm:col-span-1">
                                        <Label htmlFor="tx-date">Date</Label>
                                        <Input
                                            id="tx-date"
                                            name="transaction_date"
                                            type="date"
                                            required
                                            defaultValue={
                                                editing?.transaction_date ??
                                                today
                                            }
                                        />
                                        <InputError
                                            message={errors.transaction_date}
                                        />
                                    </div>

                                    {/* Income / Expense Fields */}
                                    {formType !== 'transfer' && (
                                        <>
                                            <div className="sm:col-span-1">
                                                <Label htmlFor="tx-account">
                                                    Account
                                                </Label>
                                                <select
                                                    id="tx-account"
                                                    name="account_id"
                                                    required
                                                    defaultValue={
                                                        editing?.account?.id
                                                            ? String(
                                                                  editing
                                                                      .account
                                                                      .id,
                                                              )
                                                            : ''
                                                    }
                                                    className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Select account...
                                                    </option>
                                                    {getAccountOptions(
                                                        editing?.account?.id,
                                                    ).map((acc) => (
                                                        <option
                                                            key={acc.id}
                                                            value={acc.id}
                                                        >
                                                            {acc.name}{' '}
                                                            {!acc.is_active
                                                                ? '(Archived)'
                                                                : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={errors.account_id}
                                                />
                                            </div>

                                            <div className="sm:col-span-1">
                                                <Label htmlFor="tx-category">
                                                    Category
                                                </Label>
                                                <select
                                                    id="tx-category"
                                                    name="category_id"
                                                    required
                                                    defaultValue={
                                                        editing?.category?.id
                                                            ? String(
                                                                  editing
                                                                      .category
                                                                      .id,
                                                              )
                                                            : ''
                                                    }
                                                    className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Select category...
                                                    </option>
                                                    {getCategoryOptions(
                                                        formType,
                                                        editing?.category?.id,
                                                    ).map((cat) => (
                                                        <option
                                                            key={cat.id}
                                                            value={cat.id}
                                                        >
                                                            {cat.name}{' '}
                                                            {!cat.is_active
                                                                ? '(Archived)'
                                                                : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={errors.category_id}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Transfer Fields */}
                                    {formType === 'transfer' && (
                                        <>
                                            <div className="sm:col-span-1">
                                                <Label htmlFor="tx-source-account">
                                                    Source Account
                                                </Label>
                                                <select
                                                    id="tx-source-account"
                                                    name="source_account_id"
                                                    required
                                                    value={sourceAccId}
                                                    onChange={(e) =>
                                                        setSourceAccId(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Select source account...
                                                    </option>
                                                    {getAccountOptions(
                                                        editing?.source_account
                                                            ?.id,
                                                    ).map((acc) => (
                                                        <option
                                                            key={acc.id}
                                                            value={acc.id}
                                                        >
                                                            {acc.name}{' '}
                                                            {!acc.is_active
                                                                ? '(Archived)'
                                                                : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <InputError
                                                    message={
                                                        errors.source_account_id
                                                    }
                                                />
                                            </div>

                                            <div className="sm:col-span-1">
                                                <Label htmlFor="tx-dest-account">
                                                    Destination Account
                                                </Label>
                                                <select
                                                    id="tx-dest-account"
                                                    name="destination_account_id"
                                                    required
                                                    defaultValue={
                                                        editing
                                                            ?.destination_account
                                                            ?.id
                                                            ? String(
                                                                  editing
                                                                      .destination_account
                                                                      .id,
                                                              )
                                                            : ''
                                                    }
                                                    className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <option value="" disabled>
                                                        Select destination
                                                        account...
                                                    </option>
                                                    {getAccountOptions(
                                                        editing
                                                            ?.destination_account
                                                            ?.id,
                                                    )
                                                        .filter(
                                                            (acc) =>
                                                                String(
                                                                    acc.id,
                                                                ) !==
                                                                sourceAccId,
                                                        )
                                                        .map((acc) => (
                                                            <option
                                                                key={acc.id}
                                                                value={acc.id}
                                                            >
                                                                {acc.name}{' '}
                                                                {!acc.is_active
                                                                    ? '(Archived)'
                                                                    : ''}
                                                            </option>
                                                        ))}
                                                </select>
                                                <InputError
                                                    message={
                                                        errors.destination_account_id
                                                    }
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Notes */}
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="tx-notes">
                                            Notes (optional)
                                        </Label>
                                        <Input
                                            id="tx-notes"
                                            name="notes"
                                            defaultValue={editing?.notes ?? ''}
                                            placeholder="Optional additional context"
                                        />
                                        <InputError message={errors.notes} />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsCreating(false);
                                                setEditing(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            disabled={processing}
                                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                                        >
                                            {editing
                                                ? 'Update transaction'
                                                : 'Save transaction'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </section>
                )}

                {/* Filters and Search Bar */}
                <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative min-w-[240px] flex-1">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search description or notes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === 'Enter' && applyFilters()
                                }
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className={
                                    showFilters
                                        ? 'border-emerald-600 text-emerald-500'
                                        : ''
                                }
                            >
                                <Filter className="mr-1.5 h-3.5 w-3.5" />
                                Filters
                            </Button>
                            <Button
                                size="sm"
                                onClick={applyFilters}
                                className="bg-emerald-700 text-white hover:bg-emerald-800"
                            >
                                Apply
                            </Button>
                            {(filters.type ||
                                filters.account_id ||
                                filters.category_id ||
                                filters.date_from ||
                                filters.date_to ||
                                filters.search) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>

                    {showFilters && (
                        <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 md:grid-cols-5">
                            <div>
                                <Label className="text-xs">Type</Label>
                                <select
                                    value={typeFilter}
                                    onChange={(e) =>
                                        setTypeFilter(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-xs"
                                >
                                    <option value="">All Types</option>
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                    <option value="transfer">Transfer</option>
                                </select>
                            </div>

                            <div>
                                <Label className="text-xs">Account</Label>
                                <select
                                    value={accountFilter}
                                    onChange={(e) =>
                                        setAccountFilter(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-xs"
                                >
                                    <option value="">All Accounts</option>
                                    {accounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name}{' '}
                                            {!acc.is_active ? '(Archived)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label className="text-xs">Category</Label>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) =>
                                        setCategoryFilter(e.target.value)
                                    }
                                    className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-xs"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name} ({cat.type}){' '}
                                            {!cat.is_active ? '(Archived)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label className="text-xs">From Date</Label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) =>
                                        setDateFrom(e.target.value)
                                    }
                                    className="mt-1 h-8 text-xs"
                                />
                            </div>

                            <div>
                                <Label className="text-xs">To Date</Label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="mt-1 h-8 text-xs"
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* Transactions Table / List */}
                <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {transactions.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Calendar className="mb-3 h-10 w-10 text-muted-foreground/60" />
                            <h3 className="text-base font-medium text-foreground">
                                No transactions found
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                {filters.type ||
                                filters.search ||
                                filters.account_id ||
                                filters.date_from
                                    ? 'Try adjusting your filters or search query.'
                                    : 'Start recording your workspace cash flow by adding your first transaction.'}
                            </p>
                            {canCreate && !isCreating && (
                                <Button
                                    size="sm"
                                    onClick={() => startCreate('expense')}
                                    className="mt-4 bg-emerald-700 text-white hover:bg-emerald-800"
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                                    transaction
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">
                                            Description
                                        </th>
                                        <th className="px-4 py-3">
                                            Category / Type
                                        </th>
                                        <th className="px-4 py-3">Account</th>
                                        <th className="px-4 py-3 text-right">
                                            Amount
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {transactions.data.map((tx) => {
                                        const isIncome = tx.type === 'income';
                                        const isExpense = tx.type === 'expense';
                                        const isTransfer =
                                            tx.type === 'transfer';

                                        return (
                                            <tr
                                                key={tx.id}
                                                className="group cursor-pointer transition hover:bg-muted/30"
                                                onClick={() =>
                                                    setDetailItem(tx)
                                                }
                                            >
                                                {/* Date */}
                                                <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                                                    {tx.transaction_date}
                                                </td>

                                                {/* Description */}
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">
                                                        {tx.description}
                                                    </div>
                                                    {tx.notes && (
                                                        <div className="line-clamp-1 text-xs text-muted-foreground">
                                                            {tx.notes}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Category / Type */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {isTransfer ? (
                                                        <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
                                                            <ArrowLeftRight className="h-3 w-3" />{' '}
                                                            Transfer
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                                                            <span
                                                                className="h-2 w-2 rounded-full"
                                                                style={{
                                                                    backgroundColor:
                                                                        tx
                                                                            .category
                                                                            ?.color ||
                                                                        '#34785A',
                                                                }}
                                                            />
                                                            {tx.category
                                                                ?.name ??
                                                                'Uncategorized'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Account */}
                                                <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                                                    {isTransfer ? (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <span className="font-medium text-foreground">
                                                                {
                                                                    tx
                                                                        .source_account
                                                                        ?.name
                                                                }
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                →
                                                            </span>
                                                            <span className="font-medium text-foreground">
                                                                {
                                                                    tx
                                                                        .destination_account
                                                                        ?.name
                                                                }
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span>
                                                            {tx.account?.name}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Amount */}
                                                <td className="px-4 py-3 text-right font-mono text-sm font-medium whitespace-nowrap">
                                                    {isIncome && (
                                                        <span className="flex items-center justify-end gap-0.5 text-emerald-500">
                                                            <ArrowDownRight className="h-3.5 w-3.5" />
                                                            +
                                                            {formatIdr(
                                                                tx.amount,
                                                            )}
                                                        </span>
                                                    )}
                                                    {isExpense && (
                                                        <span className="flex items-center justify-end gap-0.5 text-rose-400">
                                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                                            -
                                                            {formatIdr(
                                                                tx.amount,
                                                            )}
                                                        </span>
                                                    )}
                                                    {isTransfer && (
                                                        <span className="flex items-center justify-end gap-0.5 text-sky-400">
                                                            <ArrowLeftRight className="h-3 w-3" />
                                                            {formatIdr(
                                                                tx.amount,
                                                            )}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td
                                                    className="px-4 py-3 text-right text-xs whitespace-nowrap"
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        {tx.can_edit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    startEdit(
                                                                        tx,
                                                                    )
                                                                }
                                                                className="h-7 px-2 text-xs"
                                                            >
                                                                Edit
                                                            </Button>
                                                        )}
                                                        {tx.can_delete && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (
                                                                        window.confirm(
                                                                            'Are you sure you want to delete this transaction?',
                                                                        )
                                                                    ) {
                                                                        router.delete(
                                                                            `/transactions/${tx.id}`,
                                                                        );
                                                                    }
                                                                }}
                                                                className="h-7 px-2 text-xs text-rose-400 hover:text-rose-500"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {transactions.total > transactions.per_page && (
                        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                            <div>
                                Showing{' '}
                                {(transactions.current_page - 1) *
                                    transactions.per_page +
                                    1}{' '}
                                to{' '}
                                {Math.min(
                                    transactions.current_page *
                                        transactions.per_page,
                                    transactions.total,
                                )}{' '}
                                of {transactions.total} transactions
                            </div>
                            <div className="flex gap-1">
                                {transactions.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        preserveState
                                        className={`rounded px-2.5 py-1 text-xs transition ${
                                            link.active
                                                ? 'bg-emerald-700 font-medium text-white'
                                                : link.url
                                                  ? 'text-foreground hover:bg-muted'
                                                  : 'pointer-events-none text-muted-foreground/40'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Transaction Detail Modal / Drawer */}
                {detailItem && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setDetailItem(null)}
                    >
                        <div
                            className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <div>
                                    <span className="text-xs font-semibold tracking-wider text-emerald-500 uppercase">
                                        {detailItem.type}
                                    </span>
                                    <h3 className="mt-0.5 text-xl font-semibold text-foreground">
                                        {detailItem.description}
                                    </h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDetailItem(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="my-5 flex flex-col gap-3 text-sm">
                                <div className="flex justify-between border-b border-border/50 py-1">
                                    <span className="text-muted-foreground">
                                        Amount
                                    </span>
                                    <span className="font-mono font-semibold text-foreground">
                                        {formatIdr(detailItem.amount)}
                                    </span>
                                </div>

                                <div className="flex justify-between border-b border-border/50 py-1">
                                    <span className="text-muted-foreground">
                                        Date
                                    </span>
                                    <span className="text-foreground">
                                        {detailItem.transaction_date}
                                    </span>
                                </div>

                                {detailItem.type === 'transfer' ? (
                                    <>
                                        <div className="flex justify-between border-b border-border/50 py-1">
                                            <span className="text-muted-foreground">
                                                From Account
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {
                                                    detailItem.source_account
                                                        ?.name
                                                }
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-border/50 py-1">
                                            <span className="text-muted-foreground">
                                                To Account
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {
                                                    detailItem
                                                        .destination_account
                                                        ?.name
                                                }
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between border-b border-border/50 py-1">
                                            <span className="text-muted-foreground">
                                                Account
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {detailItem.account?.name}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-border/50 py-1">
                                            <span className="text-muted-foreground">
                                                Category
                                            </span>
                                            <span className="font-medium text-foreground">
                                                {detailItem.category?.name}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {detailItem.notes && (
                                    <div className="flex flex-col gap-1 border-b border-border/50 py-1">
                                        <span className="text-muted-foreground">
                                            Notes
                                        </span>
                                        <p className="text-foreground">
                                            {detailItem.notes}
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-between border-b border-border/50 py-1">
                                    <span className="text-muted-foreground">
                                        Recorded By
                                    </span>
                                    <span className="text-foreground">
                                        {detailItem.creator_name ?? 'System'}
                                    </span>
                                </div>

                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">
                                        Source
                                    </span>
                                    <span className="text-foreground capitalize">
                                        {detailItem.source}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                {detailItem.can_edit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            startEdit(detailItem);
                                            setDetailItem(null);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                )}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setDetailItem(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </AppLayout>
    );
}
