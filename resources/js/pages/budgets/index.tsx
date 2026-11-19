import { useState } from 'react';
import { Form, router } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { formatIdr } from '@/lib/format-currency';
import {
    AlertTriangle,
    Archive,
    History,
    PieChart,
    Plus,
    Trash2,
} from 'lucide-react';

export type BudgetAllocationItem = {
    category_id: number;
    category_name: string;
    category_active: boolean;
    allocated_amount: string;
    actual_amount: string;
    remaining_amount: string;
    utilization: string | null;
    warning: 'on_track' | 'warning' | 'critical' | 'exceeded';
};

export type BudgetItem = {
    id: number;
    name: string;
    period_start: string;
    period_end: string;
    total_amount: string;
    status: 'active' | 'archived';
    created_by: number;
    creator_name: string;
    can_archive: boolean;
    progress: {
        actual_amount: string;
        remaining_amount: string;
        utilization: string | null;
        warning: 'on_track' | 'warning' | 'critical' | 'exceeded';
        allocations: BudgetAllocationItem[];
    };
};

type Props = {
    budgets: BudgetItem[];
    categories: Array<{ id: number; name: string }>;
    canManage: boolean;
};

export default function BudgetsIndex({
    budgets,
    categories,
    canManage,
}: Props) {
    const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<BudgetItem | null>(null);

    // Allocations state for form builder
    const [formAllocations, setFormAllocations] = useState<
        Array<{ category_id: number; amount: string }>
    >([]);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    const activeBudgets = budgets.filter((b) => b.status === 'active');
    const currentActiveBudget = activeBudgets[0] ?? null;

    const startCreating = () => {
        setEditing(null);
        setIsCreating(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${year}-${month}`);
        setFormAllocations([]);
    };

    const startEditing = (b: BudgetItem) => {
        setIsCreating(false);
        setEditing(b);
        setSelectedMonth(b.period_start.substring(0, 7));
        setFormAllocations(
            b.progress.allocations.map((a) => ({
                category_id: a.category_id,
                amount: a.allocated_amount,
            })),
        );
    };

    const cancelForm = () => {
        setIsCreating(false);
        setEditing(null);
        setFormAllocations([]);
    };

    const handleMonthChange = (val: string) => {
        setSelectedMonth(val);
    };

    const getPeriodDates = (ym: string) => {
        if (!/^\d{4}-\d{2}$/.test(ym)) {
            return { start: '', end: '' };
        }
        const [y, m] = ym.split('-').map(Number);
        const startDate = `${ym}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${ym}-${String(lastDay).padStart(2, '0')}`;
        return { start: startDate, end: endDate };
    };

    const dates = getPeriodDates(selectedMonth);

    const addAllocation = () => {
        const unused = categories.find(
            (c) => !formAllocations.some((fa) => fa.category_id === c.id),
        );
        if (unused) {
            setFormAllocations([
                ...formAllocations,
                { category_id: unused.id, amount: '' },
            ]);
        }
    };

    const removeAllocation = (index: number) => {
        setFormAllocations(formAllocations.filter((_, i) => i !== index));
    };

    const updateAllocation = (
        index: number,
        field: 'category_id' | 'amount',
        val: number | string,
    ) => {
        const next = [...formAllocations];
        if (field === 'category_id') {
            next[index].category_id = Number(val);
        } else {
            next[index].amount = String(val);
        }
        setFormAllocations(next);
    };

    const totalAllocated = formAllocations.reduce((acc, curr) => {
        const amt = BigInt(
            curr.amount && /^\d+$/.test(curr.amount) ? curr.amount : 0,
        );
        return acc + amt;
    }, 0n);

    const getWarningBadge = (
        warning: 'on_track' | 'warning' | 'critical' | 'exceeded',
        utilization: string | null,
    ) => {
        const utilStr = utilization !== null ? `${utilization}%` : '0%';
        switch (warning) {
            case 'exceeded':
                return (
                    <Badge
                        variant="destructive"
                        className="bg-red-900/60 text-red-200"
                    >
                        Exceeded ({utilStr})
                    </Badge>
                );
            case 'critical':
                return (
                    <Badge className="bg-orange-900/60 text-orange-200">
                        Critical 90% ({utilStr})
                    </Badge>
                );
            case 'warning':
                return (
                    <Badge className="bg-amber-900/60 text-amber-200">
                        Warning 70% ({utilStr})
                    </Badge>
                );
            case 'on_track':
            default:
                return (
                    <Badge className="bg-emerald-950 text-emerald-300">
                        On track ({utilStr})
                    </Badge>
                );
        }
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Budgets', href: '/budgets' }]}>
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-emerald-500">
                            Financial Planning
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Budgets
                        </h1>
                    </div>
                    {canManage && !isCreating && !editing && (
                        <Button
                            onClick={startCreating}
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create budget
                        </Button>
                    )}
                </header>

                <div className="flex gap-2 border-b border-border pb-3">
                    <Button
                        variant={viewMode === 'current' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('current')}
                    >
                        Active budget
                    </Button>
                    <Button
                        variant={viewMode === 'history' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('history')}
                    >
                        <History className="mr-1.5 h-4 w-4" /> Monthly
                        comparison & history ({budgets.length})
                    </Button>
                </div>

                {canManage && (isCreating || editing) && (
                    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-medium text-foreground">
                                {editing
                                    ? `Edit: ${editing.name}`
                                    : 'Create monthly budget'}
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelForm}
                            >
                                Cancel
                            </Button>
                        </div>

                        <Form
                            action={
                                editing ? `/budgets/${editing.id}` : '/budgets'
                            }
                            method={editing ? 'put' : 'post'}
                            onSuccess={cancelForm}
                            className="space-y-6"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="budget_month">
                                                Calendar month
                                            </Label>
                                            <Input
                                                id="budget_month"
                                                type="month"
                                                value={selectedMonth}
                                                onChange={(e) =>
                                                    handleMonthChange(
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
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
                                                message={
                                                    errors.period_start ||
                                                    errors.period_end
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="budget_name">
                                                Budget name
                                            </Label>
                                            <Input
                                                id="budget_name"
                                                name="name"
                                                defaultValue={
                                                    editing?.name ??
                                                    `${selectedMonth} Budget`
                                                }
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="budget_total">
                                            Total budget amount (IDR)
                                        </Label>
                                        <Input
                                            id="budget_total"
                                            name="total_amount"
                                            type="text"
                                            inputMode="numeric"
                                            defaultValue={
                                                editing?.total_amount ?? ''
                                            }
                                            placeholder="e.g. 5000000"
                                            required
                                        />
                                        <InputError
                                            message={errors.total_amount}
                                        />
                                    </div>

                                    <div className="space-y-4 rounded-lg border border-border/70 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold text-foreground">
                                                    Category allocations
                                                    (optional)
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Sum of allocations must be
                                                    less than or equal to total
                                                    budget.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addAllocation}
                                                disabled={
                                                    formAllocations.length >=
                                                    categories.length
                                                }
                                            >
                                                <Plus className="mr-1 h-3.5 w-3.5" />{' '}
                                                Add category
                                            </Button>
                                        </div>

                                        {formAllocations.map((alloc, idx) => (
                                            <div
                                                key={idx}
                                                className="flex flex-wrap items-center gap-3"
                                            >
                                                <div className="w-48">
                                                    <select
                                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                                                        value={
                                                            alloc.category_id
                                                        }
                                                        onChange={(e) =>
                                                            updateAllocation(
                                                                idx,
                                                                'category_id',
                                                                e.target.value,
                                                            )
                                                        }
                                                    >
                                                        {categories.map(
                                                            (cat) => (
                                                                <option
                                                                    key={cat.id}
                                                                    value={
                                                                        cat.id
                                                                    }
                                                                >
                                                                    {cat.name}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <input
                                                        type="hidden"
                                                        name={`allocations[${idx}][category_id]`}
                                                        value={
                                                            alloc.category_id
                                                        }
                                                    />
                                                </div>

                                                <div className="flex-1">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        placeholder="Allocated amount (IDR)"
                                                        value={alloc.amount}
                                                        onChange={(e) =>
                                                            updateAllocation(
                                                                idx,
                                                                'amount',
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={`allocations[${idx}][amount]`}
                                                        value={alloc.amount}
                                                    />
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        removeAllocation(idx)
                                                    }
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}

                                        {formAllocations.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Total allocated:{' '}
                                                <span className="font-medium text-foreground">
                                                    {formatIdr(
                                                        totalAllocated.toString(),
                                                    )}
                                                </span>
                                            </p>
                                        )}

                                        <InputError
                                            message={errors.allocations}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={cancelForm}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                                        >
                                            {processing
                                                ? 'Saving...'
                                                : editing
                                                  ? 'Save changes'
                                                  : 'Create budget'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </section>
                )}

                {viewMode === 'current' && (
                    <div className="space-y-6">
                        {currentActiveBudget ? (
                            <>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Card className="bg-card">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Total budget
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                {formatIdr(
                                                    currentActiveBudget.total_amount,
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {
                                                    currentActiveBudget.period_start
                                                }{' '}
                                                to{' '}
                                                {currentActiveBudget.period_end}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-card">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Actual spent
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-rose-400">
                                                {formatIdr(
                                                    currentActiveBudget.progress
                                                        .actual_amount,
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Expense transactions only
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-card">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Remaining budget
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div
                                                className={`text-2xl font-bold ${
                                                    BigInt(
                                                        currentActiveBudget
                                                            .progress
                                                            .remaining_amount,
                                                    ) < 0n
                                                        ? 'text-red-400'
                                                        : 'text-emerald-400'
                                                }`}
                                            >
                                                {formatIdr(
                                                    currentActiveBudget.progress
                                                        .remaining_amount,
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Calculated in Rupiah
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-card">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Utilization & status
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2">
                                                {getWarningBadge(
                                                    currentActiveBudget.progress
                                                        .warning,
                                                    currentActiveBudget.progress
                                                        .utilization,
                                                )}
                                            </div>
                                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                                                <div
                                                    className={`h-full ${
                                                        currentActiveBudget
                                                            .progress
                                                            .warning ===
                                                        'exceeded'
                                                            ? 'bg-red-500'
                                                            : currentActiveBudget
                                                                    .progress
                                                                    .warning ===
                                                                'critical'
                                                              ? 'bg-orange-500'
                                                              : currentActiveBudget
                                                                      .progress
                                                                      .warning ===
                                                                  'warning'
                                                                ? 'bg-amber-500'
                                                                : 'bg-emerald-500'
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            Number(
                                                                currentActiveBudget
                                                                    .progress
                                                                    .utilization ||
                                                                    0,
                                                            ),
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {currentActiveBudget.progress.warning ===
                                    'exceeded' && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Budget exceeded</AlertTitle>
                                        <AlertDescription>
                                            Total expense transactions for this
                                            month have exceeded the budgeted
                                            allocation of{' '}
                                            {formatIdr(
                                                currentActiveBudget.total_amount,
                                            )}
                                            .
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-foreground">
                                            Category allocations
                                        </h3>
                                        <div className="flex gap-2">
                                            {canManage && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        startEditing(
                                                            currentActiveBudget,
                                                        )
                                                    }
                                                >
                                                    Edit budget
                                                </Button>
                                            )}
                                            {currentActiveBudget.can_archive && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (
                                                            confirm(
                                                                'Archive this budget? It will remain accessible in history.',
                                                            )
                                                        ) {
                                                            router.post(
                                                                `/budgets/${currentActiveBudget.id}/archive`,
                                                            );
                                                        }
                                                    }}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />{' '}
                                                    Archive
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {currentActiveBudget.progress.allocations
                                        .length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                                            No category allocations configured
                                            for this budget. All expenses count
                                            against the general budget total.
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {currentActiveBudget.progress.allocations.map(
                                                (alloc) => (
                                                    <Card
                                                        key={alloc.category_id}
                                                        className="bg-card"
                                                    >
                                                        <CardHeader className="pb-2">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="text-base font-medium">
                                                                    {
                                                                        alloc.category_name
                                                                    }
                                                                    {!alloc.category_active && (
                                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                                            (Archived)
                                                                        </span>
                                                                    )}
                                                                </CardTitle>
                                                                {getWarningBadge(
                                                                    alloc.warning,
                                                                    alloc.utilization,
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">
                                                                    Spent:{' '}
                                                                    {formatIdr(
                                                                        alloc.actual_amount,
                                                                    )}
                                                                </span>
                                                                <span className="font-medium">
                                                                    Allocated:{' '}
                                                                    {formatIdr(
                                                                        alloc.allocated_amount,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                                                <div
                                                                    className={`h-full ${
                                                                        alloc.warning ===
                                                                        'exceeded'
                                                                            ? 'bg-red-500'
                                                                            : alloc.warning ===
                                                                                'critical'
                                                                              ? 'bg-orange-500'
                                                                              : alloc.warning ===
                                                                                  'warning'
                                                                                ? 'bg-amber-500'
                                                                                : 'bg-emerald-500'
                                                                    }`}
                                                                    style={{
                                                                        width: `${Math.min(
                                                                            100,
                                                                            Number(
                                                                                alloc.utilization ||
                                                                                    0,
                                                                            ),
                                                                        )}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                                <span>
                                                                    Remaining:{' '}
                                                                    {formatIdr(
                                                                        alloc.remaining_amount,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border p-12 text-center">
                                <PieChart className="mx-auto h-12 w-12 text-muted-foreground/60" />
                                <h3 className="mt-4 text-lg font-semibold text-foreground">
                                    No active budget
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    There is no active budget for this
                                    workspace. Create one to monitor your
                                    spending and track threshold warnings.
                                </p>
                                {canManage && (
                                    <Button
                                        onClick={startCreating}
                                        className="mt-6 bg-emerald-700 text-white hover:bg-emerald-800"
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Create
                                        monthly budget
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'history' && (
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-semibold text-foreground">
                                Monthly comparison & history
                            </h3>
                            {budgets.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No budgets recorded yet.
                                </p>
                            ) : (
                                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                                    {budgets.map((b) => (
                                        <div
                                            key={b.id}
                                            className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-muted/30"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">
                                                        {b.name}
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            b.status ===
                                                            'active'
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {b.status}
                                                    </Badge>
                                                    {getWarningBadge(
                                                        b.progress.warning,
                                                        b.progress.utilization,
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Period: {b.period_start} to{' '}
                                                    {b.period_end} · Created by{' '}
                                                    {b.creator_name}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-6 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Budget
                                                    </p>
                                                    <p className="font-medium">
                                                        {formatIdr(
                                                            b.total_amount,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Actual
                                                    </p>
                                                    <p className="font-medium text-rose-400">
                                                        {formatIdr(
                                                            b.progress
                                                                .actual_amount,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Remaining
                                                    </p>
                                                    <p className="font-medium">
                                                        {formatIdr(
                                                            b.progress
                                                                .remaining_amount,
                                                        )}
                                                    </p>
                                                </div>
                                                {b.can_archive &&
                                                    b.status === 'active' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        'Archive this budget?',
                                                                    )
                                                                ) {
                                                                    router.post(
                                                                        `/budgets/${b.id}/archive`,
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            Archive
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </AppLayout>
    );
}
