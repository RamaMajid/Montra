import { Form } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatIdr } from '@/lib/format-currency';
import transactions from '@/routes/transactions';
import type {
    TransactionAccount,
    TransactionCategory,
    TransactionItem,
    TransactionType,
} from './types';

const MAX_SIGNED_INT64 = 9223372036854775807n;
const selectClass =
    'h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:text-sm';

export function TransactionForm({
    transaction,
    accounts,
    categories,
    initialType,
    onCancel,
}: {
    transaction: TransactionItem | null;
    accounts: TransactionAccount[];
    categories: TransactionCategory[];
    initialType?: TransactionType;
    onCancel: () => void;
}) {
    const [type, setType] = useState<TransactionType>(
        transaction?.type ?? initialType ?? 'expense',
    );
    const [amount, setAmount] = useState(transaction?.amount ?? '');
    const [accountId, setAccountId] = useState(
        transaction?.account?.id ? String(transaction.account.id) : '',
    );
    const [categoryId, setCategoryId] = useState(
        transaction?.category?.id ? String(transaction.category.id) : '',
    );
    const [sourceAccountId, setSourceAccountId] = useState(
        transaction?.source_account?.id
            ? String(transaction.source_account.id)
            : '',
    );
    const [destinationAccountId, setDestinationAccountId] = useState(
        transaction?.destination_account?.id
            ? String(transaction.destination_account.id)
            : '',
    );
    const [error, setError] = useState<string | null>(null);
    const descriptionRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        descriptionRef.current?.focus();
    }, [transaction?.id]);

    const originalAccountId = transaction?.account?.id
        ? String(transaction.account.id)
        : '';
    const originalCategoryId = transaction?.category?.id
        ? String(transaction.category.id)
        : '';
    const originalSourceAccountId = transaction?.source_account?.id
        ? String(transaction.source_account.id)
        : '';
    const originalDestinationAccountId = transaction?.destination_account?.id
        ? String(transaction.destination_account.id)
        : '';

    const changeType = (nextType: TransactionType) => {
        setType(nextType);
        if (nextType === 'transfer') {
            setAccountId('');
            setCategoryId('');
        } else {
            setSourceAccountId('');
            setDestinationAccountId('');
            if (
                categoryId &&
                !categories.some(
                    (category) =>
                        String(category.id) === categoryId &&
                        category.type === nextType,
                )
            ) {
                setCategoryId('');
            }
        }
    };

    const accountOptions = (originalId: string) =>
        accounts.filter(
            (account) =>
                account.is_active ||
                (originalId !== '' && String(account.id) === originalId),
        );
    const categoryOptions = categories.filter(
        (category) =>
            category.type === type &&
            (category.is_active ||
                (originalCategoryId !== '' &&
                    String(category.id) === originalCategoryId)),
    );
    const amountPreview = /^[1-9][0-9]*$/.test(amount)
        ? (() => {
              try {
                  return BigInt(amount) <= MAX_SIGNED_INT64
                      ? formatIdr(amount)
                      : null;
              } catch {
                  return null;
              }
          })()
        : null;
    const route = transaction
        ? transactions.update.form(transaction.id)
        : transactions.store.form();

    return (
        <section
            aria-labelledby="transaction-form-title"
            className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
            <div className="mb-6">
                <h2
                    id="transaction-form-title"
                    className="text-lg font-semibold"
                >
                    {transaction
                        ? `Edit ${transaction.description}`
                        : 'Add transaction'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Record income, expense, or transfer in whole Rupiah.
                </p>
            </div>
            {error && (
                <div className="mb-5">
                    <AlertError title="Transaction error" errors={[error]} />
                </div>
            )}
            <Form
                {...route}
                onSuccess={onCancel}
                onStart={() => setError(null)}
                onHttpException={() => {
                    setError('Unable to save transaction. Please try again.');
                    return false;
                }}
                onNetworkError={() => {
                    setError('Unable to save transaction. Please try again.');
                    return false;
                }}
                options={{ preserveScroll: true }}
                className="grid gap-5 sm:grid-cols-2"
            >
                {({ errors, processing }) => {
                    const errorSummary = Object.values(errors).filter(
                        (message): message is string => Boolean(message),
                    );

                    return (
                        <>
                            {errorSummary.length > 0 && (
                                <div className="sm:col-span-2">
                                    <AlertError
                                        title="Check transaction details"
                                        errors={errorSummary}
                                    />
                                </div>
                            )}
                            <Field
                                label="Transaction type"
                                id="transaction-type"
                                error={errors.type}
                                required
                            >
                                <select
                                    id="transaction-type"
                                    name="type"
                                    required
                                    value={type}
                                    onChange={(event) =>
                                        changeType(
                                            event.target
                                                .value as TransactionType,
                                        )
                                    }
                                    aria-invalid={Boolean(errors.type)}
                                    aria-describedby={describedBy(
                                        'transaction-type',
                                        errors.type,
                                    )}
                                    className={selectClass}
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="transfer">Transfer</option>
                                </select>
                            </Field>
                            <Field
                                label="Description"
                                id="transaction-description"
                                error={errors.description}
                                required
                            >
                                <Input
                                    ref={descriptionRef}
                                    id="transaction-description"
                                    name="description"
                                    required
                                    maxLength={255}
                                    defaultValue={
                                        transaction?.description ?? ''
                                    }
                                    aria-invalid={Boolean(errors.description)}
                                    aria-describedby={describedBy(
                                        'transaction-description',
                                        errors.description,
                                    )}
                                />
                            </Field>
                            <Field
                                label="Amount (IDR)"
                                id="transaction-amount"
                                error={errors.amount}
                                description="Positive whole Rupiah amount, up to signed 64-bit maximum."
                                required
                            >
                                <Input
                                    id="transaction-amount"
                                    name="amount"
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[1-9][0-9]*"
                                    value={amount}
                                    onChange={(event) => {
                                        const next = event.target.value.replace(
                                            /\D/g,
                                            '',
                                        );
                                        setAmount(next);
                                        event.currentTarget.setCustomValidity(
                                            next !== '' &&
                                                (!/^[1-9][0-9]*$/.test(next) ||
                                                    BigInt(next) >
                                                        MAX_SIGNED_INT64)
                                                ? 'Enter a positive whole Rupiah amount within the signed 64-bit range.'
                                                : '',
                                        );
                                    }}
                                    aria-invalid={Boolean(errors.amount)}
                                    aria-describedby={describedBy(
                                        'transaction-amount',
                                        errors.amount,
                                        true,
                                    )}
                                    className="font-numeric text-base sm:text-sm"
                                />
                                {amountPreview && (
                                    <p className="font-numeric text-xs font-medium text-muted-foreground">
                                        Formatted: {amountPreview}
                                    </p>
                                )}
                            </Field>
                            <Field
                                label="Date"
                                id="transaction-date"
                                error={errors.transaction_date}
                                required
                            >
                                <Input
                                    id="transaction-date"
                                    name="transaction_date"
                                    type="date"
                                    required
                                    defaultValue={
                                        transaction?.transaction_date ?? ''
                                    }
                                    aria-invalid={Boolean(
                                        errors.transaction_date,
                                    )}
                                    aria-describedby={describedBy(
                                        'transaction-date',
                                        errors.transaction_date,
                                    )}
                                    className="font-numeric"
                                />
                            </Field>
                            {type !== 'transfer' ? (
                                <>
                                    <Field
                                        label="Account"
                                        id="transaction-account"
                                        error={errors.account_id}
                                        required
                                    >
                                        <select
                                            id="transaction-account"
                                            name="account_id"
                                            required
                                            value={accountId}
                                            onChange={(event) =>
                                                setAccountId(event.target.value)
                                            }
                                            aria-invalid={Boolean(
                                                errors.account_id,
                                            )}
                                            aria-describedby={describedBy(
                                                'transaction-account',
                                                errors.account_id,
                                            )}
                                            className={selectClass}
                                        >
                                            <option value="" disabled>
                                                Select account
                                            </option>
                                            {accountOptions(
                                                originalAccountId,
                                            ).map((account) => (
                                                <option
                                                    key={account.id}
                                                    value={account.id}
                                                >
                                                    {account.name}
                                                    {!account.is_active
                                                        ? ' (Archived)'
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field
                                        label="Category"
                                        id="transaction-category"
                                        error={errors.category_id}
                                        required
                                    >
                                        <select
                                            id="transaction-category"
                                            name="category_id"
                                            required
                                            value={categoryId}
                                            onChange={(event) =>
                                                setCategoryId(
                                                    event.target.value,
                                                )
                                            }
                                            aria-invalid={Boolean(
                                                errors.category_id,
                                            )}
                                            aria-describedby={describedBy(
                                                'transaction-category',
                                                errors.category_id,
                                            )}
                                            className={selectClass}
                                        >
                                            <option value="" disabled>
                                                Select category
                                            </option>
                                            {categoryOptions.map((category) => (
                                                <option
                                                    key={category.id}
                                                    value={category.id}
                                                >
                                                    {category.name}
                                                    {!category.is_active
                                                        ? ' (Archived)'
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </>
                            ) : (
                                <>
                                    <AccountSelect
                                        id="transaction-source-account"
                                        label="Source account"
                                        name="source_account_id"
                                        value={sourceAccountId}
                                        error={errors.source_account_id}
                                        accounts={accountOptions(
                                            originalSourceAccountId,
                                        )}
                                        disabledId={destinationAccountId}
                                        onChange={(nextSourceId) => {
                                            setSourceAccountId(nextSourceId);
                                            if (
                                                nextSourceId &&
                                                nextSourceId ===
                                                    destinationAccountId
                                            ) {
                                                setDestinationAccountId('');
                                            }
                                        }}
                                    />
                                    <AccountSelect
                                        id="transaction-destination-account"
                                        label="Destination account"
                                        name="destination_account_id"
                                        value={destinationAccountId}
                                        error={errors.destination_account_id}
                                        accounts={accountOptions(
                                            originalDestinationAccountId,
                                        )}
                                        disabledId={sourceAccountId}
                                        onChange={(nextDestId) => {
                                            setDestinationAccountId(nextDestId);
                                            if (
                                                nextDestId &&
                                                nextDestId === sourceAccountId
                                            ) {
                                                setSourceAccountId('');
                                            }
                                        }}
                                    />
                                </>
                            )}
                            <Field
                                label="Notes"
                                id="transaction-notes"
                                error={errors.notes}
                                className="sm:col-span-2"
                            >
                                <textarea
                                    id="transaction-notes"
                                    name="notes"
                                    maxLength={2000}
                                    defaultValue={transaction?.notes ?? ''}
                                    aria-invalid={Boolean(errors.notes)}
                                    aria-describedby={describedBy(
                                        'transaction-notes',
                                        errors.notes,
                                    )}
                                    className="min-h-24 w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
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
                                        : transaction
                                          ? 'Save changes'
                                          : 'Save transaction'}
                                </Button>
                            </div>
                        </>
                    );
                }}
            </Form>
        </section>
    );
}

function AccountSelect({
    id,
    label,
    name,
    value,
    error,
    accounts,
    disabledId,
    onChange,
}: {
    id: string;
    label: string;
    name: string;
    value: string;
    error?: string;
    accounts: TransactionAccount[];
    disabledId?: string;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label} id={id} error={error} required>
            <select
                id={id}
                name={name}
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy(id, error)}
                className={selectClass}
            >
                <option value="" disabled>
                    Select account
                </option>
                {accounts.map((account) => (
                    <option
                        key={account.id}
                        value={account.id}
                        disabled={
                            Boolean(disabledId) &&
                            String(account.id) === disabledId
                        }
                    >
                        {account.name}
                        {!account.is_active ? ' (Archived)' : ''}
                    </option>
                ))}
            </select>
        </Field>
    );
}

function describedBy(id: string, error?: string, includeDescription = false) {
    return (
        [
            includeDescription ? `${id}-description` : null,
            error ? `${id}-error` : null,
        ]
            .filter(Boolean)
            .join(' ') || undefined
    );
}

function Field({
    label,
    id,
    error,
    description,
    required,
    className,
    children,
}: {
    label: string;
    id: string;
    error?: string;
    description?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
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
