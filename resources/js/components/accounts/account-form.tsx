import { Form } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import accounts from '@/routes/accounts';
import { accountTypes, type AccountItem, type AccountType } from './types';

export function AccountForm({
    account,
    type,
    onTypeChange,
    onCancel,
}: {
    account: AccountItem | null;
    type: AccountType;
    onTypeChange: (type: AccountType) => void;
    onCancel: () => void;
}) {
    const allowsNegative = type === 'bank' || type === 'other';
    const route = account
        ? accounts.update.form(account.id)
        : accounts.store.form();
    const [error, setError] = useState<string | null>(null);

    return (
        <section
            aria-labelledby="account-form-title"
            className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
            <div className="mb-6">
                <h2 id="account-form-title" className="text-lg font-semibold">
                    {account ? `Edit ${account.name}` : 'Add account'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Current balance remains server-calculated from initial
                    balance and transactions.
                </p>
            </div>
            {error && (
                <div className="mb-5">
                    <AlertError title="Account error" errors={[error]} />
                </div>
            )}
            <Form
                {...route}
                onSuccess={onCancel}
                onStart={() => setError(null)}
                onHttpException={() => {
                    setError('Unable to save account. Please try again.');
                    return false;
                }}
                onNetworkError={() => {
                    setError('Unable to save account. Please try again.');
                    return false;
                }}
                options={{ preserveScroll: true }}
                className="grid gap-5 sm:grid-cols-2"
            >
                {({ errors, processing }) => (
                    <>
                        <Field
                            label="Account name"
                            error={errors.name}
                            required
                        >
                            <Input
                                id="account-name"
                                name="name"
                                required
                                maxLength={255}
                                defaultValue={account?.name ?? ''}
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={
                                    errors.name
                                        ? 'account-name-error'
                                        : undefined
                                }
                            />
                        </Field>
                        <Field
                            label="Account type"
                            error={errors.type}
                            required
                        >
                            <select
                                id="account-type"
                                name="type"
                                required
                                value={type}
                                onChange={(event) =>
                                    onTypeChange(
                                        event.target.value as AccountType,
                                    )
                                }
                                aria-invalid={Boolean(errors.type)}
                                aria-describedby={
                                    errors.type
                                        ? 'account-type-error'
                                        : undefined
                                }
                                className="h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
                            >
                                {accountTypes.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label="Initial balance (IDR)"
                            error={errors.initial_balance}
                            required
                            description={
                                allowsNegative
                                    ? 'Whole Rupiah amount. Bank and Other accounts may start below zero.'
                                    : 'Whole Rupiah amount, zero or greater.'
                            }
                        >
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
                                defaultValue={account?.initial_balance ?? '0'}
                                aria-invalid={Boolean(errors.initial_balance)}
                                aria-describedby={
                                    errors.initial_balance
                                        ? 'account-initial-balance-description account-initial-balance-error'
                                        : 'account-initial-balance-description'
                                }
                                className="font-numeric text-base sm:text-sm"
                            />
                        </Field>
                        <Field
                            label="Institution or provider"
                            error={errors.institution}
                        >
                            <Input
                                id="account-institution"
                                name="institution"
                                maxLength={255}
                                defaultValue={account?.institution ?? ''}
                                aria-invalid={Boolean(errors.institution)}
                                aria-describedby={
                                    errors.institution
                                        ? 'account-institution-error'
                                        : undefined
                                }
                            />
                        </Field>
                        <Field
                            label="Description"
                            error={errors.description}
                            className="sm:col-span-2"
                        >
                            <textarea
                                id="account-description"
                                name="description"
                                maxLength={2000}
                                defaultValue={account?.description ?? ''}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={
                                    errors.description
                                        ? 'account-description-error'
                                        : undefined
                                }
                                className="min-h-24 w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
                            />
                        </Field>
                        <Field
                            label="Color"
                            error={errors.color}
                            description="Optional six-digit hex color, for example #34785A."
                        >
                            <Input
                                id="account-color"
                                name="color"
                                pattern="#[0-9a-fA-F]{6}"
                                defaultValue={account?.color ?? ''}
                                placeholder="#34785A"
                                aria-invalid={Boolean(errors.color)}
                                aria-describedby={
                                    errors.color
                                        ? 'account-color-description account-color-error'
                                        : 'account-color-description'
                                }
                            />
                        </Field>
                        <Field
                            label="Icon identifier"
                            error={errors.icon}
                            description="Optional stored icon name; no icon library mapping is applied."
                        >
                            <Input
                                id="account-icon"
                                name="icon"
                                maxLength={64}
                                defaultValue={account?.icon ?? ''}
                                aria-invalid={Boolean(errors.icon)}
                                aria-describedby={
                                    errors.icon
                                        ? 'account-icon-description account-icon-error'
                                        : 'account-icon-description'
                                }
                            />
                        </Field>
                        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}{' '}
                                {processing
                                    ? 'Saving…'
                                    : account
                                      ? 'Save changes'
                                      : 'Create account'}
                            </Button>
                        </div>
                    </>
                )}
            </Form>
        </section>
    );
}

function Field({
    label,
    error,
    description,
    required,
    className,
    children,
}: {
    label: string;
    error?: string;
    description?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    const id =
        label === 'Initial balance (IDR)'
            ? 'account-initial-balance'
            : label === 'Institution or provider'
              ? 'account-institution'
              : label === 'Account name'
                ? 'account-name'
                : label === 'Account type'
                  ? 'account-type'
                  : `account-${label.toLowerCase().split(' ')[0]}`;
    return (
        <div className={`grid gap-2 ${className ?? ''}`}>
            <Label htmlFor={id}>
                {label}
                {required && (
                    <span aria-hidden="true" className="text-destructive">
                        {' '}
                        *
                    </span>
                )}
            </Label>
            {children}
            {description && (
                <p
                    id={`${id}-description`}
                    className="text-xs leading-5 text-muted-foreground"
                >
                    {description}
                </p>
            )}
            <InputError id={`${id}-error`} message={error} />
        </div>
    );
}
