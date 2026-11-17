import { useState } from 'react';
import { Form, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { formatIdr } from '@/lib/format-currency';
import { Archive, Plus, RotateCcw } from 'lucide-react';

export type AccountItem = {
    id: number;
    name: string;
    type: 'bank' | 'e_wallet' | 'cash' | 'savings' | 'other';
    initial_balance: string;
    institution: string | null;
    description: string | null;
    color: string | null;
    icon: string | null;
    is_active: boolean;
};

type Props = {
    accounts: AccountItem[];
    canManage: boolean;
};

export default function AccountsIndex({ accounts, canManage }: Props) {
    const [editing, setEditing] = useState<AccountItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [type, setType] = useState<string>('bank');

    const allowsNegative = type === 'bank' || type === 'other';

    return (
        <AppLayout breadcrumbs={[{ title: 'Accounts', href: '/accounts' }]}>
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-emerald-500">
                            Workspace
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Accounts
                        </h1>
                    </div>
                    {canManage && !isCreating && !editing && (
                        <Button
                            onClick={() => {
                                setIsCreating(true);
                                setType('bank');
                            }}
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add account
                        </Button>
                    )}
                </header>

                {canManage && (isCreating || editing) && (
                    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-medium text-foreground">
                                {editing
                                    ? `Edit: ${editing.name}`
                                    : 'New account'}
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditing(null);
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                        <Form
                            action={
                                editing
                                    ? `/accounts/${editing.id}`
                                    : '/accounts'
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
                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-name">
                                            Name
                                        </Label>
                                        <Input
                                            id="account-name"
                                            name="name"
                                            required
                                            defaultValue={editing?.name ?? ''}
                                            placeholder="e.g. BCA Tabungan"
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-type">
                                            Type
                                        </Label>
                                        <select
                                            id="account-type"
                                            name="type"
                                            value={type}
                                            onChange={(e) =>
                                                setType(e.target.value)
                                            }
                                            className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            <option value="bank">Bank</option>
                                            <option value="e_wallet">
                                                E-Wallet
                                            </option>
                                            <option value="cash">Cash</option>
                                            <option value="savings">
                                                Savings
                                            </option>
                                            <option value="other">Other</option>
                                        </select>
                                        <InputError message={errors.type} />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-initial-balance">
                                            Initial balance (IDR)
                                        </Label>
                                        <Input
                                            id="account-initial-balance"
                                            name="initial_balance"
                                            required
                                            type="text"
                                            inputMode="numeric"
                                            pattern={
                                                allowsNegative
                                                    ? '-?(0|[1-9][0-9]*)'
                                                    : '(0|[1-9][0-9]*)'
                                            }
                                            defaultValue={
                                                editing?.initial_balance ?? '0'
                                            }
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {allowsNegative
                                                ? 'Signed Rupiah integer (negative permitted for credit line/overdraft).'
                                                : 'Non-negative Rupiah integer.'}
                                        </p>
                                        <InputError
                                            message={errors.initial_balance}
                                        />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-institution">
                                            Institution / Provider
                                        </Label>
                                        <Input
                                            id="account-institution"
                                            name="institution"
                                            defaultValue={
                                                editing?.institution ?? ''
                                            }
                                            placeholder="e.g. Bank Central Asia"
                                        />
                                        <InputError
                                            message={errors.institution}
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <Label htmlFor="account-description">
                                            Description
                                        </Label>
                                        <Input
                                            id="account-description"
                                            name="description"
                                            defaultValue={
                                                editing?.description ?? ''
                                            }
                                            placeholder="Optional notes"
                                        />
                                        <InputError
                                            message={errors.description}
                                        />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-color">
                                            Color (hex)
                                        </Label>
                                        <Input
                                            id="account-color"
                                            name="color"
                                            defaultValue={
                                                editing?.color ?? '#34785A'
                                            }
                                            placeholder="#34785A"
                                        />
                                        <InputError message={errors.color} />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="account-icon">
                                            Icon identifier
                                        </Label>
                                        <Input
                                            id="account-icon"
                                            name="icon"
                                            defaultValue={editing?.icon ?? ''}
                                            placeholder="e.g. wallet, landmark"
                                        />
                                        <InputError message={errors.icon} />
                                    </div>

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
                                                ? 'Update account'
                                                : 'Create account'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </section>
                )}

                <section className="flex flex-col gap-4">
                    {accounts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
                            No accounts yet. Click "Add account" above to create
                            your first financial account.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {accounts.map((acc) => (
                                <div
                                    key={acc.id}
                                    className={`relative flex flex-col justify-between rounded-xl border bg-card p-5 transition ${
                                        acc.is_active
                                            ? 'border-border'
                                            : 'border-border/50 bg-card/60 opacity-70'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className="inline-block h-3 w-3 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        acc.color || '#34785A',
                                                }}
                                            />
                                            <span className="text-xs tracking-wider text-muted-foreground uppercase">
                                                {acc.type.replace('_', ' ')}
                                            </span>
                                            {!acc.is_active && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                    Archived
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="mt-3 text-lg font-medium text-foreground">
                                            {acc.name}
                                        </h3>
                                        {acc.institution && (
                                            <p className="text-sm text-muted-foreground">
                                                {acc.institution}
                                            </p>
                                        )}

                                        <div className="mt-4">
                                            <p className="text-xs text-muted-foreground">
                                                Initial Balance
                                            </p>
                                            <p className="text-xl font-semibold tracking-tight text-foreground">
                                                {formatIdr(acc.initial_balance)}
                                            </p>
                                        </div>

                                        {acc.description && (
                                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                                {acc.description}
                                            </p>
                                        )}
                                    </div>

                                    {canManage && (
                                        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditing(acc);
                                                    setType(acc.type);
                                                    setIsCreating(false);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            {acc.is_active ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            `/accounts/${acc.id}/archive`,
                                                        )
                                                    }
                                                    className="text-amber-500 hover:text-amber-600"
                                                >
                                                    <Archive className="mr-1 h-3.5 w-3.5" />{' '}
                                                    Archive
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            `/accounts/${acc.id}/restore`,
                                                        )
                                                    }
                                                    className="text-emerald-500 hover:text-emerald-600"
                                                >
                                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />{' '}
                                                    Restore
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </AppLayout>
    );
}
