import { Form } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatIdr } from '@/lib/format-currency';
import budgets from '@/routes/budgets';
import type { BudgetCategoryOption, BudgetItem } from './types';

type Allocation = { category_id: number; amount: string };

export function allocationsExceedTotal(
    allocated: bigint,
    total: string,
): boolean {
    return /^[1-9][0-9]*$/.test(total) && allocated > BigInt(total);
}

const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function periodDates(month: string): { start: string; end: string } {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return { start: '', end: '' };
    }

    const [year, monthNumber] = month.split('-').map(Number);
    if (year < 1) {
        return { start: '', end: '' };
    }

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const endDay = monthNumber === 2 && isLeap ? 29 : MONTH_DAYS[monthNumber];

    return {
        start: `${month}-01`,
        end: `${month}-${String(endDay).padStart(2, '0')}`,
    };
}

function describedBy(id: string, error?: string, helpId?: string) {
    return (
        [helpId, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
        undefined
    );
}

export function BudgetForm({
    budget,
    categories,
    onCancel,
}: {
    budget: BudgetItem | null;
    categories: BudgetCategoryOption[];
    onCancel: () => void;
}) {
    const [requestError, setRequestError] = useState<string | null>(null);
    const [month, setMonth] = useState(budget?.period_start.slice(0, 7) ?? '');
    const [totalAmount, setTotalAmount] = useState(budget?.total_amount ?? '');
    const [allocations, setAllocations] = useState<Allocation[]>(
        budget?.progress.allocations.map((allocation) => ({
            category_id: allocation.category_id,
            amount: allocation.allocated_amount,
        })) ?? [],
    );
    const existingCategoryIds = useMemo(
        () =>
            new Set(
                budget?.progress.allocations.map(
                    (allocation) => allocation.category_id,
                ) ?? [],
            ),
        [budget],
    );
    const activeCategories = useMemo(
        () => categories.filter((category) => category.is_active !== false),
        [categories],
    );
    const dates = periodDates(month);
    const totalAllocated = useMemo(
        () =>
            allocations.reduce(
                (total, allocation) =>
                    total +
                    BigInt(
                        /^[1-9][0-9]*$/.test(allocation.amount)
                            ? allocation.amount
                            : '0',
                    ),
                0n,
            ),
        [allocations],
    );
    const allocationOverflow = allocationsExceedTotal(
        totalAllocated,
        totalAmount,
    );
    const usedCategoryIds = new Set(
        allocations.map((allocation) => allocation.category_id),
    );
    const nextActiveCategory = activeCategories.find(
        (option) => !usedCategoryIds.has(option.id),
    );

    const addAllocation = () => {
        if (nextActiveCategory) {
            setAllocations((current) => [
                ...current,
                { category_id: nextActiveCategory.id, amount: '' },
            ]);
        }
    };

    return (
        <section
            aria-labelledby="budget-form-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
            <Form
                {...(budget
                    ? budgets.update.form(budget.id)
                    : budgets.store.form())}
                options={{ preserveScroll: true }}
                className="space-y-5"
                onStart={() => setRequestError(null)}
                onSuccess={onCancel}
                onHttpException={() => {
                    setRequestError('Unable to save budget. Please try again.');
                    return false;
                }}
                onNetworkError={() => {
                    setRequestError('Unable to save budget. Please try again.');
                    return false;
                }}
            >
                {({ errors, processing }) => {
                    const periodError =
                        errors.period_start ?? errors.period_end;
                    const formErrors = [
                        ...(requestError ? [requestError] : []),
                        ...Object.values(errors).filter(Boolean),
                    ];
                    return (
                        <fieldset disabled={processing} className="space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2
                                        id="budget-form-heading"
                                        className="text-base font-semibold"
                                    >
                                        {budget
                                            ? `Edit ${budget.name}`
                                            : 'Create monthly budget'}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Budgets cover one full calendar month.
                                        Allocations are optional and cannot
                                        exceed total budget.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={processing}
                                    onClick={onCancel}
                                >
                                    Cancel
                                </Button>
                            </div>

                            {formErrors.length > 0 && (
                                <AlertError
                                    title="Budget could not be saved"
                                    errors={formErrors}
                                />
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="budget-month">
                                        Calendar month
                                    </Label>
                                    <Input
                                        id="budget-month"
                                        type="month"
                                        value={month}
                                        onChange={(event) =>
                                            setMonth(event.target.value)
                                        }
                                        required
                                        aria-invalid={Boolean(periodError)}
                                        aria-describedby={describedBy(
                                            'budget-month',
                                            periodError,
                                            'budget-period-help',
                                        )}
                                    />
                                    <p
                                        id="budget-period-help"
                                        className="mt-1 text-xs text-muted-foreground"
                                    >
                                        Start and end dates are sent as the
                                        first and last day of selected month.
                                    </p>
                                    <input
                                        type="hidden"
                                        name="period_start"
                                        value={dates.start}
                                    />
                                    <input
                                        type="hidden"
                                        name="period_end"
                                        value={dates.end}
                                    />
                                    <InputError
                                        id="budget-month-error"
                                        message={periodError}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="budget-name">
                                        Budget name
                                    </Label>
                                    <Input
                                        id="budget-name"
                                        name="name"
                                        maxLength={255}
                                        defaultValue={budget?.name ?? ''}
                                        placeholder="November household plan"
                                        required
                                        aria-invalid={Boolean(errors.name)}
                                        aria-describedby={describedBy(
                                            'budget-name',
                                            errors.name,
                                        )}
                                    />
                                    <InputError
                                        id="budget-name-error"
                                        message={errors.name}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="budget-total">
                                    Total budget amount (IDR)
                                </Label>
                                <Input
                                    id="budget-total"
                                    name="total_amount"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[1-9][0-9]*"
                                    value={totalAmount}
                                    onChange={(event) =>
                                        setTotalAmount(event.target.value)
                                    }
                                    placeholder="5000000"
                                    required
                                    aria-invalid={Boolean(errors.total_amount)}
                                    aria-describedby={describedBy(
                                        'budget-total',
                                        errors.total_amount,
                                        'budget-total-help',
                                    )}
                                />
                                <p
                                    id="budget-total-help"
                                    className="mt-1 text-xs text-muted-foreground"
                                >
                                    Positive whole Rupiah value. Do not enter
                                    separators.
                                </p>
                                <InputError
                                    id="budget-total-error"
                                    message={errors.total_amount}
                                />
                            </div>

                            <fieldset className="space-y-4 rounded-md border border-border p-4">
                                <legend className="px-1 text-sm font-medium">
                                    Category allocations (optional)
                                </legend>
                                <p className="text-xs text-muted-foreground">
                                    Only active expense categories are available
                                    for new allocations.
                                </p>
                                {activeCategories.length === 0 &&
                                    allocations.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            No active expense categories
                                            available. You can still save a
                                            general monthly budget without
                                            category allocations.
                                        </p>
                                    )}
                                {allocations.map((allocation, index) => {
                                    const categoryError =
                                        errors[
                                            `allocations.${index}.category_id`
                                        ];
                                    const amountError =
                                        errors[`allocations.${index}.amount`];
                                    const categoryId = `allocation-category-${index}`;
                                    const amountId = `allocation-amount-${index}`;
                                    const rowCategories = categories.filter(
                                        (category) =>
                                            category.is_active !== false ||
                                            (category.id ===
                                                allocation.category_id &&
                                                existingCategoryIds.has(
                                                    category.id,
                                                )),
                                    );

                                    return (
                                        <div
                                            key={`${allocation.category_id}-${index}`}
                                            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
                                        >
                                            <div>
                                                <Label htmlFor={categoryId}>
                                                    Category {index + 1}
                                                </Label>
                                                <select
                                                    id={categoryId}
                                                    name={`allocations[${index}][category_id]`}
                                                    value={
                                                        allocation.category_id
                                                    }
                                                    onChange={(event) => {
                                                        const value = Number(
                                                            event.target.value,
                                                        );
                                                        setAllocations(
                                                            (current) =>
                                                                current.map(
                                                                    (
                                                                        item,
                                                                        itemIndex,
                                                                    ) =>
                                                                        itemIndex ===
                                                                        index
                                                                            ? {
                                                                                  ...item,
                                                                                  category_id:
                                                                                      value,
                                                                              }
                                                                            : item,
                                                                ),
                                                        );
                                                    }}
                                                    aria-invalid={Boolean(
                                                        categoryError,
                                                    )}
                                                    aria-describedby={describedBy(
                                                        categoryId,
                                                        categoryError,
                                                    )}
                                                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                                                >
                                                    {rowCategories.map(
                                                        (category) => (
                                                            <option
                                                                key={
                                                                    category.id
                                                                }
                                                                value={
                                                                    category.id
                                                                }
                                                                disabled={
                                                                    category.id !==
                                                                        allocation.category_id &&
                                                                    usedCategoryIds.has(
                                                                        category.id,
                                                                    )
                                                                }
                                                            >
                                                                {category.name}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <InputError
                                                    id={`${categoryId}-error`}
                                                    message={categoryError}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor={amountId}>
                                                    Allocated amount (IDR)
                                                </Label>
                                                <Input
                                                    id={amountId}
                                                    name={`allocations[${index}][amount]`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[1-9][0-9]*"
                                                    value={allocation.amount}
                                                    onChange={(event) =>
                                                        setAllocations(
                                                            (current) =>
                                                                current.map(
                                                                    (
                                                                        item,
                                                                        itemIndex,
                                                                    ) =>
                                                                        itemIndex ===
                                                                        index
                                                                            ? {
                                                                                  ...item,
                                                                                  amount: event
                                                                                      .target
                                                                                      .value,
                                                                              }
                                                                            : item,
                                                                ),
                                                        )
                                                    }
                                                    required
                                                    aria-invalid={Boolean(
                                                        amountError,
                                                    )}
                                                    aria-describedby={describedBy(
                                                        amountId,
                                                        amountError,
                                                    )}
                                                />
                                                <InputError
                                                    id={`${amountId}-error`}
                                                    message={amountError}
                                                />
                                            </div>
                                            <div className="sm:pt-6">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Remove allocation ${index + 1}`}
                                                    onClick={() =>
                                                        setAllocations(
                                                            (current) =>
                                                                current.filter(
                                                                    (
                                                                        _,
                                                                        itemIndex,
                                                                    ) =>
                                                                        itemIndex !==
                                                                        index,
                                                                ),
                                                        )
                                                    }
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addAllocation}
                                        disabled={!nextActiveCategory}
                                    >
                                        <Plus aria-hidden="true" /> Add category
                                    </Button>
                                    <p className="font-numeric text-sm text-muted-foreground">
                                        Allocated:{' '}
                                        <span className="font-medium text-foreground">
                                            {formatIdr(
                                                totalAllocated.toString(),
                                            )}
                                        </span>
                                    </p>
                                </div>
                                <InputError
                                    id="budget-allocations-error"
                                    message={
                                        errors.allocations ??
                                        (allocationOverflow
                                            ? 'Category allocations cannot exceed the total budget.'
                                            : undefined)
                                    }
                                />
                            </fieldset>

                            <div className="flex flex-wrap justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={processing}
                                    onClick={onCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={processing || allocationOverflow}
                                >
                                    {processing && <Spinner />}
                                    {processing
                                        ? 'Saving budget…'
                                        : budget
                                          ? 'Save changes'
                                          : 'Create budget'}
                                </Button>
                            </div>
                        </fieldset>
                    );
                }}
            </Form>
        </section>
    );
}

export { periodDates };
