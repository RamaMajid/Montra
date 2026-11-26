import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPercent, ratio } from '@/lib/format-currency';
import type { BudgetWarning } from './types';

export const budgetWarningMeta: Record<
    BudgetWarning,
    {
        label: string;
        className: string;
        fillClassName: string;
        textClassName: string;
        icon: typeof CheckCircle2;
    }
> = {
    on_track: {
        label: 'On track',
        className: 'border-income/40 bg-income/10 text-income',
        fillClassName: 'bg-income',
        textClassName: 'text-income',
        icon: CheckCircle2,
    },
    warning: {
        label: 'Approaching limit',
        className: 'border-warning/40 bg-warning/10 text-warning',
        fillClassName: 'bg-warning',
        textClassName: 'text-warning',
        icon: AlertTriangle,
    },
    critical: {
        label: 'Critical',
        className: 'border-expense/40 bg-expense/10 text-expense',
        fillClassName: 'bg-expense',
        textClassName: 'text-expense',
        icon: AlertTriangle,
    },
    exceeded: {
        label: 'Exceeded',
        className: 'border-destructive/40 bg-destructive/10 text-destructive',
        fillClassName: 'bg-destructive',
        textClassName: 'text-destructive',
        icon: AlertCircle,
    },
};

export function BudgetWarningBadge({
    warning,
    utilization,
}: {
    warning: BudgetWarning;
    utilization: string | null;
}) {
    const meta = budgetWarningMeta[warning];
    const Icon = meta.icon;

    return (
        <Badge variant="outline" className={meta.className}>
            <Icon aria-hidden="true" className="mr-1 size-3" />
            {meta.label} · {formatPercent(utilization)}
        </Badge>
    );
}

export function BudgetStatusBadge({
    status,
}: {
    status: 'active' | 'archived';
}) {
    return (
        <Badge
            variant="outline"
            className={
                status === 'active'
                    ? 'border-income/40 bg-income/10 text-income'
                    : 'border-border text-muted-foreground'
            }
        >
            {status === 'active' ? 'Active' : 'Archived'}
        </Badge>
    );
}

export function BudgetProgressBar({
    label,
    actualAmount,
    targetAmount,
    utilization,
    warning,
}: {
    label: string;
    actualAmount?: string;
    targetAmount?: string;
    utilization: string | null;
    warning: BudgetWarning;
}) {
    const percentageFromAmounts =
        actualAmount !== undefined && targetAmount !== undefined
            ? Math.round(ratio(actualAmount, targetAmount) * 10000) / 100
            : null;
    const rawPercentage =
        percentageFromAmounts ??
        (utilization === null ? 0 : Number.parseFloat(utilization));
    const safePercentage = Number.isFinite(rawPercentage)
        ? Math.max(0, Math.min(100, rawPercentage))
        : 0;
    const meta = budgetWarningMeta[warning];

    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{label}</span>
                <span
                    className={`font-numeric font-medium ${meta.textClassName}`}
                >
                    {formatPercent(utilization)}
                </span>
            </div>
            <div
                role="progressbar"
                aria-label={`${label} utilization`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={safePercentage}
                aria-valuetext={`${formatPercent(utilization)}, ${meta.label}`}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
                <div
                    className={`h-full rounded-full transition-[width] ${meta.fillClassName}`}
                    style={{ width: `${safePercentage}%` }}
                />
            </div>
        </div>
    );
}
