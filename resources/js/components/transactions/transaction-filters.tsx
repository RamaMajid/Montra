import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import transactions from '@/routes/transactions';
import type {
    TransactionAccount,
    TransactionCategory,
    TransactionFilters as Filters,
} from './types';

export const sortOptions = [
    { value: 'date_desc', label: 'Newest first' },
    { value: 'date_asc', label: 'Oldest first' },
    { value: 'amount_desc', label: 'Highest amount' },
    { value: 'amount_asc', label: 'Lowest amount' },
] as const;

export function buildTransactionQuery(
    filters: Partial<Filters>,
): Record<string, string> {
    const query: Record<string, string> = {};
    for (const key of [
        'type',
        'account_id',
        'category_id',
        'date_from',
        'date_to',
        'search',
    ] as const) {
        const value = filters[key]?.trim();
        if (value) query[key] = value;
    }
    if (filters.sort && filters.sort !== 'date_desc') {
        query.sort = filters.sort;
    }
    return query;
}

export function TransactionFilters({
    filters,
    accounts,
    categories,
    onLoadingChange,
    onErrorChange,
}: {
    filters: Filters;
    accounts: TransactionAccount[];
    categories: TransactionCategory[];
    onLoadingChange?: (loading: boolean) => void;
    onErrorChange?: (message: string | null) => void;
}) {
    const [draft, setDraft] = useState<Filters>({
        type: filters.type ?? '',
        account_id: filters.account_id ?? '',
        category_id: filters.category_id ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
        search: filters.search ?? '',
        sort: filters.sort || 'date_desc',
    });
    const [loading, setLoading] = useState(false);

    const invalidDateRange = Boolean(
        draft.date_from && draft.date_to && draft.date_from > draft.date_to,
    );
    const hasActive = Boolean(
        draft.type ||
        draft.account_id ||
        draft.category_id ||
        draft.date_from ||
        draft.date_to ||
        draft.search.trim() ||
        draft.sort !== 'date_desc',
    );
    const filteredCategories = categories.filter(
        (cat) =>
            draft.type !== 'transfer' &&
            (!draft.type || cat.type === draft.type),
    );

    const visit = (next: Filters) => {
        setLoading(true);
        onLoadingChange?.(true);
        onErrorChange?.(null);
        router.get(transactions.index.url(), buildTransactionQuery(next), {
            preserveState: true,
            preserveScroll: true,
            onHttpException: () => {
                onErrorChange?.(
                    'Unable to load transactions. Please try again.',
                );
                return false;
            },
            onNetworkError: () => {
                onErrorChange?.(
                    'Unable to load transactions. Please try again.',
                );
                return false;
            },
            onFinish: () => {
                setLoading(false);
                onLoadingChange?.(false);
            },
        });
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (invalidDateRange) {
            onErrorChange?.('Start date cannot be after end date.');
            return;
        }
        visit(draft);
    };

    const clear = () => {
        const empty: Filters = {
            type: '',
            account_id: '',
            category_id: '',
            date_from: '',
            date_to: '',
            search: '',
            sort: 'date_desc',
        };
        setDraft(empty);
        visit(empty);
    };

    const selectClass =
        'h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:text-sm';

    return (
        <search aria-label="Filter and sort transactions">
            <form
                method="get"
                action={transactions.index.url()}
                onSubmit={submit}
                className="rounded-lg border border-border bg-card p-4 sm:p-5"
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="filter-search">Search</Label>
                        <Input
                            id="filter-search"
                            name="search"
                            type="search"
                            value={draft.search}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    search: event.target.value,
                                })
                            }
                            placeholder="Description or notes"
                            disabled={loading}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-type">Type</Label>
                        <select
                            id="filter-type"
                            name="type"
                            value={draft.type}
                            disabled={loading}
                            onChange={(event) => {
                                const type = event.target.value;
                                setDraft({
                                    ...draft,
                                    type,
                                    category_id:
                                        type === 'transfer'
                                            ? ''
                                            : draft.category_id,
                                });
                            }}
                            className={selectClass}
                        >
                            <option value="">All types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-sort">Sort order</Label>
                        <select
                            id="filter-sort"
                            name="sort"
                            value={draft.sort}
                            disabled={loading}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    sort: event.target.value,
                                })
                            }
                            className={selectClass}
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-account">Account</Label>
                        <select
                            id="filter-account"
                            name="account_id"
                            value={draft.account_id}
                            disabled={loading}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    account_id: event.target.value,
                                })
                            }
                            className={selectClass}
                        >
                            <option value="">All accounts</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                    {acc.is_active ? '' : ' (Archived)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-category">Category</Label>
                        <select
                            id="filter-category"
                            name="category_id"
                            value={draft.category_id}
                            disabled={loading || draft.type === 'transfer'}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    category_id: event.target.value,
                                })
                            }
                            className={selectClass}
                        >
                            <option value="">All categories</option>
                            {filteredCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                    {cat.is_active ? '' : ' (Archived)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-date-from">From date</Label>
                        <Input
                            id="filter-date-from"
                            name="date_from"
                            type="date"
                            value={draft.date_from}
                            max={draft.date_to || undefined}
                            disabled={loading}
                            aria-invalid={invalidDateRange}
                            aria-describedby={
                                invalidDateRange
                                    ? 'filter-date-range-error'
                                    : undefined
                            }
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    date_from: event.target.value,
                                })
                            }
                            className="font-numeric"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filter-date-to">To date</Label>
                        <Input
                            id="filter-date-to"
                            name="date_to"
                            type="date"
                            value={draft.date_to}
                            min={draft.date_from || undefined}
                            disabled={loading}
                            aria-invalid={invalidDateRange}
                            aria-describedby={
                                invalidDateRange
                                    ? 'filter-date-range-error'
                                    : undefined
                            }
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    date_to: event.target.value,
                                })
                            }
                            className="font-numeric"
                        />
                    </div>
                </div>
                {invalidDateRange && (
                    <p
                        id="filter-date-range-error"
                        role="alert"
                        className="mt-3 text-sm text-destructive"
                    >
                        Start date cannot be after end date.
                    </p>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {hasActive && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={clear}
                        >
                            Clear filters
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={loading || invalidDateRange}
                    >
                        {loading && <Spinner />}{' '}
                        {loading ? 'Filtering…' : 'Apply filters'}
                    </Button>
                </div>
            </form>
        </search>
    );
}
