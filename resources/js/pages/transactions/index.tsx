import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { TransactionFilters } from '@/components/transactions/transaction-filters';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { TransactionList } from '@/components/transactions/transaction-list';
import type {
    PaginatedTransactions,
    TransactionAccount,
    TransactionCategory,
    TransactionFilters as Filters,
    TransactionItem,
} from '@/components/transactions/types';
import transactions from '@/routes/transactions';

type Props = {
    transactions: PaginatedTransactions;
    accounts: TransactionAccount[];
    categories: TransactionCategory[];
    filters: Filters;
    canCreate: boolean;
};

export default function TransactionsIndex({
    transactions: items,
    accounts,
    categories,
    filters,
    canCreate,
}: Props) {
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<TransactionItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const openCreate = () => {
        setEditing(null);
        setCreating(true);
    };
    const closeForm = () => {
        setCreating(false);
        setEditing(null);
    };

    return (
        <>
            <Head title="Transactions" />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Workspace"
                    title="Transactions"
                    description="Record and review income, expenses, and transfers. Balances and totals remain server-calculated."
                    actions={
                        canCreate && !creating && !editing ? (
                            <Button onClick={() => openCreate()}>
                                Add transaction
                            </Button>
                        ) : undefined
                    }
                />
                {error && (
                    <AlertError title="Transaction error" errors={[error]} />
                )}
                {((canCreate && creating) || Boolean(editing?.can_edit)) && (
                    <TransactionForm
                        key={editing?.id ?? 'new-transaction'}
                        transaction={editing}
                        accounts={accounts}
                        categories={categories}
                        onCancel={closeForm}
                    />
                )}
                <TransactionFilters
                    filters={filters}
                    accounts={accounts}
                    categories={categories}
                    onLoadingChange={setLoading}
                    onErrorChange={setError}
                />
                <div
                    aria-busy={loading}
                    className={loading ? 'opacity-60' : undefined}
                >
                    <TransactionList
                        transactions={items}
                        onEdit={setEditing}
                        onDetail={() => undefined}
                        onCreate={() => openCreate()}
                        canCreate={canCreate}
                    />
                </div>
                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={['Enable JavaScript to manage transactions.']}
                    />
                </noscript>
            </main>
        </>
    );
}

TransactionsIndex.layout = {
    breadcrumbs: [{ title: 'Transactions', href: transactions.index.url() }],
};
