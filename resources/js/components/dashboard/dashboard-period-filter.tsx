import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { dashboard } from '@/routes';
import type { DashboardFilters, PeriodType } from './types';

export const periodOptions: { value: PeriodType; label: string }[] = [
    { value: 'current_month', label: 'This month' },
    { value: 'previous_month', label: 'Last month' },
    { value: 'custom', label: 'Custom range' },
];

type Props = {
    period: PeriodType;
    startDate: string;
    endDate: string;
    onLoadingChange?: (loading: boolean) => void;
    onErrorChange?: (message: string | null) => void;
};

export function buildQuery(
    period: PeriodType,
    from: string,
    to: string,
): DashboardFilters {
    return period === 'custom'
        ? { period, date_from: from, date_to: to }
        : { period };
}

export function DashboardPeriodFilter({
    period,
    startDate,
    endDate,
    onLoadingChange,
    onErrorChange,
}: Props) {
    const errors = usePage().props.errors as Record<string, string> | undefined;
    const [selected, setSelected] = useState<PeriodType>(period);
    const [from, setFrom] = useState(startDate);
    const [to, setTo] = useState(endDate);
    const error = errors ? Object.values(errors)[0] : undefined;

    const onSubmit = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            dashboard.url(),
            buildQuery(selected, from, to) as Record<string, string>,
            {
                only: [
                    'period',
                    'summary',
                    'trends',
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
                    onErrorChange?.(null);
                    onLoadingChange?.(true);
                },
                onNetworkError: () => {
                    onErrorChange?.(
                        'Unable to update the dashboard. Please try again.',
                    );

                    return false;
                },
                onHttpException: () => {
                    onErrorChange?.(
                        'Unable to update the dashboard. Please try again.',
                    );

                    return false;
                },
                onFinish: () => onLoadingChange?.(false),
            },
        );
    };

    return (
        <form
            action={dashboard.url()}
            method="get"
            onSubmit={onSubmit}
            className="flex flex-wrap items-end gap-3"
            aria-label="Dashboard period"
        >
            <div className="grid gap-1.5">
                <label
                    htmlFor="dashboard-period"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Period
                </label>
                <select
                    id="dashboard-period"
                    name="period"
                    value={selected}
                    onChange={(event) =>
                        setSelected(event.target.value as PeriodType)
                    }
                    className="h-12 min-w-40 rounded-md border border-input bg-surface px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                >
                    {periodOptions.map((option) => (
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
                            htmlFor="dashboard-from"
                            className="text-xs font-medium text-muted-foreground"
                        >
                            From
                        </label>
                        <input
                            id="dashboard-from"
                            name="date_from"
                            type="date"
                            required
                            value={from}
                            max={to || undefined}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={
                                error ? 'dashboard-filter-error' : undefined
                            }
                            onChange={(event) => setFrom(event.target.value)}
                            className="h-12 rounded-md border border-input bg-surface px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <label
                            htmlFor="dashboard-to"
                            className="text-xs font-medium text-muted-foreground"
                        >
                            To
                        </label>
                        <input
                            id="dashboard-to"
                            name="date_to"
                            type="date"
                            required
                            value={to}
                            min={from || undefined}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={
                                error ? 'dashboard-filter-error' : undefined
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
            {error && (
                <p
                    id="dashboard-filter-error"
                    role="alert"
                    className="basis-full text-sm text-destructive"
                >
                    {error}
                </p>
            )}
        </form>
    );
}
