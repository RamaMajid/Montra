import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { AccountForm } from '@/components/accounts/account-form';
import { AccountList } from '@/components/accounts/account-list';
import type {
    AccountItem,
    AccountType,
    AccountsProps,
} from '@/components/accounts/types';
import AlertError from '@/components/alert-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import accounts from '@/routes/accounts';

export default function AccountsIndex({
    accounts: items,
    canManage,
}: AccountsProps) {
    const [editing, setEditing] = useState<AccountItem | null>(null);
    const [creating, setCreating] = useState(false);
    const [type, setType] = useState<AccountType>('bank');

    const openCreate = () => {
        setEditing(null);
        setType('bank');
        setCreating(true);
    };
    const openEdit = (account: AccountItem) => {
        setCreating(false);
        setEditing(account);
        setType(account.type);
    };
    const closeForm = () => {
        setCreating(false);
        setEditing(null);
    };

    return (
        <>
            <Head title="Accounts" />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    title="Accounts"
                    description="See your account balances and manage the resources connected to this workspace."
                    actions={
                        canManage && !creating && !editing ? (
                            <Button onClick={openCreate}>Add account</Button>
                        ) : undefined
                    }
                />
                {canManage && (creating || editing) && (
                    <AccountForm
                        key={editing?.id ?? 'new-account'}
                        account={editing}
                        type={type}
                        onTypeChange={setType}
                        onCancel={closeForm}
                    />
                )}
                {items.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Showing {items.length} server-provided account
                        {items.length === 1 ? '' : 's'}. Current balances
                        include valid transactions and transfers.
                    </p>
                )}
                <AccountList
                    accounts={items}
                    canManage={canManage}
                    onEdit={openEdit}
                    onCreate={openCreate}
                />
                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={['Enable JavaScript to manage accounts.']}
                    />
                </noscript>
            </main>
        </>
    );
}

AccountsIndex.layout = {
    breadcrumbs: [{ title: 'Accounts', href: accounts.index.url() }],
};
