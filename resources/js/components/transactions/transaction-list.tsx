import { Form, Link } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    Eye,
    Pencil,
    Plus,
    Receipt,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatDateId, formatIdr } from '@/lib/format-currency';
import transactionsRoutes from '@/routes/transactions';
import type { PaginatedTransactions, TransactionItem } from './types';

type Props = {
    transactions: PaginatedTransactions;
    canCreate: boolean;
    onCreate: () => void;
    onEdit: (transaction: TransactionItem) => void;
    onDetail: (transaction: TransactionItem) => void;
};

const typeMeta = {
    income: {
        label: 'Income',
        Icon: ArrowDownLeft,
        sign: '+',
        className: 'text-income',
    },
    expense: {
        label: 'Expense',
        Icon: ArrowUpRight,
        sign: '-',
        className: 'text-expense',
    },
    transfer: {
        label: 'Transfer',
        Icon: ArrowLeftRight,
        sign: '',
        className: 'text-transfer',
    },
} as const;

function accountLabel(transaction: TransactionItem): string {
    if (transaction.type === 'transfer') {
        return `${transaction.source_account?.name ?? '—'} → ${transaction.destination_account?.name ?? '—'}`;
    }

    return transaction.account?.name ?? '—';
}

function categoryLabel(transaction: TransactionItem): string {
    return transaction.type === 'transfer'
        ? 'Transfer'
        : (transaction.category?.name ?? 'Uncategorized');
}

function Amount({ transaction }: { transaction: TransactionItem }) {
    const meta = typeMeta[transaction.type];

    return (
        <span className={`font-numeric font-semibold ${meta.className}`}>
            <span className="sr-only">{meta.label}: </span>
            {meta.sign}
            {formatIdr(transaction.amount)}
        </span>
    );
}

function TransactionActions({
    transaction,
    onEdit,
    onDetail,
}: {
    transaction: TransactionItem;
    onEdit: (transaction: TransactionItem) => void;
    onDetail: (transaction: TransactionItem) => void;
}) {
    return (
        <div className="flex flex-wrap justify-end gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDetail(transaction)}
            >
                <Eye aria-hidden="true" />
                Details
                <span className="sr-only"> for {transaction.description}</span>
            </Button>
            {transaction.can_edit && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(transaction)}
                >
                    <Pencil aria-hidden="true" />
                    Edit
                    <span className="sr-only"> {transaction.description}</span>
                </Button>
            )}
            {transaction.can_delete && (
                <DeleteTransactionDialog transaction={transaction} />
            )}
        </div>
    );
}

export function DeleteTransactionForm({
    transaction,
    onCancel,
    onSuccess,
}: {
    transaction: TransactionItem;
    onCancel?: () => void;
    onSuccess?: () => void;
}) {
    const [error, setError] = useState<string | null>(null);

    return (
        <Form
            {...transactionsRoutes.destroy.form(transaction.id)}
            options={{ preserveScroll: true }}
            onStart={() => setError(null)}
            onSuccess={() => onSuccess?.()}
            onHttpException={() => {
                setError('Unable to delete transaction. Please try again.');
                return false;
            }}
            onNetworkError={() => {
                setError('Unable to delete transaction. Please try again.');
                return false;
            }}
        >
            {({ processing, errors }) => (
                <>
                    {(error || Object.values(errors).length > 0) && (
                        <p role="alert" className="text-sm text-destructive">
                            {error ??
                                'Unable to delete transaction. Please try again.'}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            autoFocus
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing}
                        >
                            {processing ? 'Deleting…' : 'Delete transaction'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

export function DeleteTransactionDialog({
    transaction,
}: {
    transaction: TransactionItem;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                >
                    <Trash2 aria-hidden="true" />
                    Delete
                    <span className="sr-only"> {transaction.description}</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete transaction?</DialogTitle>
                    <DialogDescription>
                        “{transaction.description}” will be removed from the
                        workspace and its account balance will be recalculated.
                    </DialogDescription>
                </DialogHeader>
                <DeleteTransactionForm
                    transaction={transaction}
                    onCancel={() => setOpen(false)}
                    onSuccess={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

export function TransactionDetailBody({
    transaction,
    onClose,
    onEdit,
}: {
    transaction: TransactionItem;
    onClose: () => void;
    onEdit: (transaction: TransactionItem) => void;
}) {
    const meta = typeMeta[transaction.type];

    return (
        <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-y border-border py-4 text-sm">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="text-right">
                    <Amount transaction={transaction} />
                </dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-right">
                    {formatDateId(transaction.transaction_date)}
                </dd>
                <dt className="text-muted-foreground">
                    {transaction.type === 'transfer' ? 'Accounts' : 'Account'}
                </dt>
                <dd className="text-right">{accountLabel(transaction)}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd className={`text-right font-medium ${meta.className}`}>
                    {meta.label}
                </dd>
                {transaction.type !== 'transfer' && (
                    <>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd className="text-right">
                            {categoryLabel(transaction)}
                        </dd>
                    </>
                )}
                {transaction.notes && (
                    <>
                        <dt className="text-muted-foreground">Notes</dt>
                        <dd className="text-right break-words">
                            {transaction.notes}
                        </dd>
                    </>
                )}
                <dt className="text-muted-foreground">Recorded by</dt>
                <dd className="text-right">
                    {transaction.creator_name ?? 'System'}
                </dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="text-right capitalize">{transaction.source}</dd>
            </dl>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Close
                </Button>
                {transaction.can_edit && (
                    <Button
                        type="button"
                        onClick={() => {
                            onClose();
                            onEdit(transaction);
                        }}
                    >
                        Edit transaction
                    </Button>
                )}
            </DialogFooter>
        </>
    );
}

export function TransactionDetailDialog({
    transaction,
    open,
    onOpenChange,
    onEdit,
}: {
    transaction: TransactionItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit: (transaction: TransactionItem) => void;
}) {
    if (!transaction) return null;

    const meta = typeMeta[transaction.type];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="pr-6 break-words">
                        {transaction.description}
                    </DialogTitle>
                    <DialogDescription>
                        {meta.label} transaction details
                    </DialogDescription>
                </DialogHeader>
                <TransactionDetailBody
                    transaction={transaction}
                    onClose={() => onOpenChange(false)}
                    onEdit={onEdit}
                />
            </DialogContent>
        </Dialog>
    );
}

export function TransactionList({
    transactions,
    canCreate,
    onCreate,
    onEdit,
    onDetail,
}: Props) {
    const [detail, setDetail] = useState<TransactionItem | null>(null);

    const openDetail = (transaction: TransactionItem) => {
        setDetail(transaction);
        onDetail(transaction);
    };

    if (transactions.data.length === 0) {
        return (
            <EmptyState
                icon={Receipt}
                title="No transactions found"
                description="Add a transaction or adjust your filters to see workspace activity."
                action={
                    canCreate ? (
                        <Button type="button" onClick={onCreate}>
                            <Plus aria-hidden="true" /> Add transaction
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    const firstItem =
        (transactions.current_page - 1) * transactions.per_page + 1;
    const lastItem = Math.min(
        transactions.current_page * transactions.per_page,
        transactions.total,
    );

    return (
        <section aria-labelledby="transaction-list-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2
                    id="transaction-list-title"
                    className="text-lg font-semibold"
                >
                    Transactions
                </h2>
                <p className="font-numeric text-sm text-muted-foreground">
                    {firstItem}–{lastItem} of {transactions.total}
                </p>
            </div>

            <div
                role="region"
                aria-labelledby="transaction-table-caption"
                tabIndex={0}
                className="hidden overflow-x-auto rounded-lg border border-border md:block"
            >
                <table className="w-full min-w-[40rem] text-left text-sm">
                    <caption id="transaction-table-caption" className="sr-only">
                        Workspace transactions with dates, types, accounts,
                        amounts, and available actions
                    </caption>
                    <thead className="bg-surface-elevated text-xs text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-4 py-3">
                                Date
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Transaction
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Account
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Amount
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {transactions.data.map((transaction) => {
                            const meta = typeMeta[transaction.type];
                            return (
                                <tr key={transaction.id}>
                                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                        {formatDateId(
                                            transaction.transaction_date,
                                        )}
                                    </td>
                                    <th
                                        scope="row"
                                        className="px-4 py-4 font-normal"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                                <meta.Icon
                                                    aria-hidden="true"
                                                    className={`size-4 ${meta.className}`}
                                                />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block font-medium text-foreground">
                                                    {transaction.description}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {categoryLabel(transaction)}
                                                </span>
                                            </span>
                                        </div>
                                    </th>
                                    <td className="px-4 py-4">
                                        {accountLabel(transaction)}
                                    </td>
                                    <td className="px-4 py-4 text-right whitespace-nowrap">
                                        <Amount transaction={transaction} />
                                    </td>
                                    <td className="px-4 py-4">
                                        <TransactionActions
                                            transaction={transaction}
                                            onEdit={onEdit}
                                            onDetail={openDetail}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul
                role="list"
                className="divide-y divide-border rounded-lg border border-border md:hidden"
            >
                {transactions.data.map((transaction) => {
                    const meta = typeMeta[transaction.type];
                    return (
                        <li key={transaction.id} className="p-4">
                            <article>
                                <div className="flex items-start gap-3">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <meta.Icon
                                            aria-hidden="true"
                                            className={`size-4 ${meta.className}`}
                                        />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="font-medium break-words">
                                                {transaction.description}
                                            </h3>
                                            <Amount transaction={transaction} />
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {formatDateId(
                                                transaction.transaction_date,
                                            )}{' '}
                                            · {categoryLabel(transaction)}
                                        </p>
                                        <p className="mt-1 text-sm break-words">
                                            {accountLabel(transaction)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 border-t border-border pt-2">
                                    <TransactionActions
                                        transaction={transaction}
                                        onEdit={onEdit}
                                        onDetail={openDetail}
                                    />
                                </div>
                            </article>
                        </li>
                    );
                })}
            </ul>

            {transactions.last_page > 1 && (
                <nav
                    aria-label="Transaction pages"
                    className="mt-4 flex items-center justify-between gap-4"
                >
                    {transactions.prev_page_url ? (
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={transactions.prev_page_url}
                                preserveScroll
                                preserveState
                            >
                                Previous
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" disabled>
                            Previous
                        </Button>
                    )}
                    <span className="font-numeric text-sm text-muted-foreground">
                        Page {transactions.current_page} of{' '}
                        {transactions.last_page}
                    </span>
                    {transactions.next_page_url ? (
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={transactions.next_page_url}
                                preserveScroll
                                preserveState
                            >
                                Next
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" disabled>
                            Next
                        </Button>
                    )}
                </nav>
            )}

            <TransactionDetailDialog
                transaction={detail}
                open={detail !== null}
                onOpenChange={(open) => {
                    if (!open) setDetail(null);
                }}
                onEdit={onEdit}
            />
        </section>
    );
}

export function TransactionsSkeleton() {
    return (
        <div aria-label="Loading transactions" className="grid gap-3">
            {[1, 2, 3].map((key) => (
                <div
                    key={key}
                    className="h-20 animate-pulse rounded-lg bg-muted"
                />
            ))}
        </div>
    );
}
