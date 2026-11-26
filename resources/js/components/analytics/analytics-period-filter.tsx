import { router, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { PeriodType } from '@/components/dashboard/types';
import analytics from '@/routes/analytics';

export const analyticsPeriodOptions: { value: PeriodType; label: string }[] = [
    { value: 'current_month', label: 'This month' },
    { value: 'previous_month', label: 'Last month' },
    { value: 'custom', label: 'Custom range' },
];

export function buildAnalyticsQuery(
    period: PeriodType,
    from: string,
    to: string,
): Record<string, string> {
    return period === 'custom'
        ? { period, date_from: from, date_to: to }
        : { period };
}

export function AnalyticsPeriodFilter({
    period,
    startDate,
    endDate,
    onLoadingChange,
    onErrorChange,
}: {
    period: PeriodType;
    startDate: string;
    endDate: string;
    onLoadingChange: (loading: boolean) => void;
    onErrorChange: (error: string | null) => void;
}) {
    const errors = usePage().props.errors as Record<string, string> | undefined;
    const [selected, setSelected] = useState(period);
    const [from, setFrom] = useState(startDate);
    const [to, setTo] = useState(endDate);
    const error = errors ? Object.values(errors)[0] : undefined;

    const visit = (nextPeriod: PeriodType) => {
        router.get(
            analytics.page.url(),
            buildAnalyticsQuery(nextPeriod, from, to),
            {
                only: [
                    'period',
                    'summary',
                    'trends',
                    'category_trends',
                    'savings_rate_trends',
                    'expense_breakdown',
                    'account_distribution',
                    'budget',
                    'recent_transactions',
                    'filters',
                    'errors',
                ],
                preserveScroll: true,
                preserveState: true,
                replace: true,
                onStart: () => {
                    onErrorChange(null);
                    onLoadingChange(true);
                },
                onSuccess: () => onErrorChange(null),
                onNetworkError: () => {
                    onErrorChange(
                        'Unable to update analytics. Please try again.',
                    );
                    return false;
                },
                onHttpException: () => {
                    onErrorChange(
                        'Unable to update analytics. Please try again.',
                    );
                    return false;
                },
                onFinish: () => onLoadingChange(false),
            },
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit(selected);
    };

    const reset = () => {
        setSelected('current_month');
        onErrorChange(null);
        visit('current_month');
    };

    return (
        <search>
            <form
                action={analytics.page.url()}
                method="get"
                onSubmit={submit}
                aria-label="Analytics period"
                className="flex flex-wrap items-end gap-3"
            >
                <div className="grid gap-1.5">
                    <label
                        htmlFor="analytics-period"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Period
                    </label>
                    <select
                        id="analytics-period"
                        name="period"
                        value={selected}
                        onChange={(event) =>
                            setSelected(event.target.value as PeriodType)
                        }
                        className="h-12 min-w-40 rounded-md border border-input bg-surface px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                    >
                        {analyticsPeriodOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                {selected === 'custom' && (
                    <>
                        <div className="grid gap-1.5">
                            <label
                                htmlFor="analytics-from"
                                className="text-xs font-medium text-muted-foreground"
                            >
                                From
                            </label>
                            <input
                                id="analytics-from"
                                name="date_from"
                                type="date"
                                required
                                value={from}
                                max={to || undefined}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={
                                    error ? 'analytics-filter-error' : undefined
                                }
                                onChange={(event) =>
                                    setFrom(event.target.value)
                                }
                                className="h-12 rounded-md border border-input bg-surface px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <label
                                htmlFor="analytics-to"
                                className="text-xs font-medium text-muted-foreground"
                            >
                                To
                            </label>
                            <input
                                id="analytics-to"
                                name="date_to"
                                type="date"
                                required
                                value={to}
                                min={from || undefined}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={
                                    error ? 'analytics-filter-error' : undefined
                                }
                                onChange={(event) => setTo(event.target.value)}
                                className="h-12 rounded-md border border-input bg-surface px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                            />
                        </div>
                    </>
                )}
                <Button type="submit" className="h-12">
                    Apply period
                </Button>
                {period !== 'current_month' && (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={reset}
                    >
                        Reset
                    </Button>
                )}
                {error && (
                    <p
                        id="analytics-filter-error"
                        role="alert"
                        className="basis-full text-sm text-destructive"
                    >
                        {error}
                    </p>
                )}
            </form>
        </search>
    );
}
