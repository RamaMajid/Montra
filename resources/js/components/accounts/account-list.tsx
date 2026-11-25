import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { Pencil, RotateCcw, WalletCards } from 'lucide-react';
import { ArchiveDialog } from '@/components/archive-dialog';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { formatIdr } from '@/lib/format-currency';
import accounts from '@/routes/accounts';
import { accountTypeLabels, type AccountItem } from './types';

export function AccountList({
    accounts: items,
    canManage,
    onEdit,
    onCreate,
}: {
    accounts: AccountItem[];
    canManage: boolean;
    onEdit: (account: AccountItem) => void;
    onCreate: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    if (items.length === 0) {
        return (
            <EmptyState
                icon={WalletCards}
                title="No accounts yet"
                description="Add a bank, e-wallet, cash, savings, or other account to track its server-calculated balance."
                action={
                    canManage ? (
                        <Button onClick={onCreate}>Add account</Button>
                    ) : undefined
                }
            />
        );
    }

    return (
        <section aria-labelledby="account-list-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="account-list-title" className="text-lg font-semibold">
                    All accounts
                </h2>
                <p className="text-sm text-muted-foreground">
                    Active and archived
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((account) => (
                    <article
                        key={account.id}
                        className={`flex min-w-0 flex-col rounded-lg border bg-card p-5 ${account.is_active ? 'border-border' : 'border-border/70 opacity-75'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span
                                    aria-hidden="true"
                                    className="size-3 shrink-0 rounded-full ring-2 ring-background"
                                    style={{
                                        backgroundColor:
                                            account.color ?? 'var(--primary)',
                                    }}
                                />
                                <div className="min-w-0">
                                    <h3
                                        className="truncate font-semibold"
                                        title={account.name}
                                    >
                                        {account.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {accountTypeLabels[account.type]}
                                        {account.institution
                                            ? ` · ${account.institution}`
                                            : ''}
                                    </p>
                                </div>
                            </div>
                            {!account.is_active && (
                                <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium">
                                    Archived
                                </span>
                            )}
                        </div>
                        <div className="mt-6">
                            <p className="text-xs font-medium text-muted-foreground">
                                Current balance
                            </p>
                            <p
                                className={`font-numeric mt-1 text-2xl font-semibold break-all ${BigInt(account.current_balance) < 0n ? 'text-expense' : ''}`}
                            >
                                {formatIdr(account.current_balance)}
                            </p>
                            <p className="font-numeric mt-1 text-xs text-muted-foreground">
                                Initial balance{' '}
                                {formatIdr(account.initial_balance)}
                            </p>
                        </div>
                        {account.description && (
                            <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {account.description}
                            </p>
                        )}
                        <div className="mt-auto flex flex-wrap justify-end gap-1 border-t border-border pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(account)}
                                disabled={!canManage}
                            >
                                <Pencil /> Edit
                            </Button>
                            {canManage &&
                                (account.is_active ? (
                                    <ArchiveDialog
                                        name={account.name}
                                        noun="account"
                                        route={accounts.archive.form(
                                            account.id,
                                        )}
                                    />
                                ) : (
                                    <Form
                                        {...accounts.restore.form(account.id)}
                                        options={{ preserveScroll: true }}
                                        onHttpException={() => {
                                            setError(
                                                'Unable to restore account. Please try again.',
                                            );
                                            return false;
                                        }}
                                        onNetworkError={() => {
                                            setError(
                                                'Unable to restore account. Please try again.',
                                            );
                                            return false;
                                        }}
                                        onStart={() => setError(null)}
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <Button
                                                    type="submit"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={processing}
                                                >
                                                    <RotateCcw />{' '}
                                                    {processing
                                                        ? 'Restoring…'
                                                        : 'Restore'}
                                                </Button>
                                                {(error ||
                                                    Object.values(errors)
                                                        .length > 0) && (
                                                    <p
                                                        role="alert"
                                                        className="text-sm text-destructive"
                                                    >
                                                        {error ??
                                                            'Unable to restore account.'}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </Form>
                                ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

export function AccountsSkeleton() {
    return (
        <div
            aria-label="Loading accounts"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
            {[1, 2, 3].map((key) => (
                <div
                    key={key}
                    className="h-52 animate-pulse rounded-lg bg-muted"
                />
            ))}
        </div>
    );
}
