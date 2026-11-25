import { Link } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowLeftRight,
    ArrowUpRight,
    FileSpreadsheet,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { formatDateId, formatIdr } from '@/lib/format-currency';
import { cn } from '@/lib/utils';
import { ImportRowStatusBadge } from './import-status-badge';
import type {
    ImportAccountOption,
    ImportCategoryOption,
    ImportRowItem,
    PaginatedImportRows,
} from './types';

function resolveRowTypeMeta(type?: string | null) {
    switch (type) {
        case 'income':
            return {
                label: 'Income',
                sign: '+',
                className: 'text-income',
                icon: ArrowDownLeft,
            };
        case 'expense':
            return {
                label: 'Expense',
                sign: '-',
                className: 'text-expense',
                icon: ArrowUpRight,
            };
        case 'transfer':
            return {
                label: 'Transfer',
                sign: '',
                className: 'text-transfer',
                icon: ArrowLeftRight,
            };
        default:
            return {
                label: type || 'Unknown',
                sign: '',
                className: 'text-muted-foreground',
                icon: null,
            };
    }
}

export function formatImportRowAmount(row: ImportRowItem): {
    formatted: string;
    srPrefix: string;
    className: string;
} {
    const rawAmount = row.normalized_data?.amount;
    const text =
        rawAmount === null || rawAmount === undefined ? '' : String(rawAmount);
    const meta = resolveRowTypeMeta(row.normalized_data?.type);

    if (!/^[1-9][0-9]*$/.test(text)) {
        return {
            formatted: text === 'INVALID_AMOUNT' ? 'Invalid amount' : '—',
            srPrefix: '',
            className: 'text-destructive',
        };
    }

    return {
        formatted: `${meta.sign}${formatIdr(text)}`,
        srPrefix: `${meta.label}: `,
        className: meta.className,
    };
}

export function resolveImportRowAccountAndCategory(
    row: ImportRowItem,
    accounts: ImportAccountOption[],
    categories: ImportCategoryOption[],
): { accountLabel: string; categoryLabel: string } {
    const data = row.normalized_data;
    if (!data) {
        return { accountLabel: '—', categoryLabel: '—' };
    }

    if (data.type === 'transfer') {
        const sourceId = Number(data.source_account_id);
        const destId = Number(data.destination_account_id);
        const source = accounts.find((acc) => acc.id === sourceId)?.name;
        const dest = accounts.find((acc) => acc.id === destId)?.name;
        return {
            accountLabel:
                source && dest
                    ? `${source} → ${dest}`
                    : source || dest
                      ? `${source ?? 'Unselected'} → ${dest ?? 'Unselected'}`
                      : 'No transfer accounts',
            categoryLabel: 'Transfer (no category)',
        };
    }

    const accountId = Number(data.account_id);
    const categoryId = Number(data.category_id);
    const account = accounts.find((acc) => acc.id === accountId)?.name;
    const category = categories.find((cat) => cat.id === categoryId)?.name;

    return {
        accountLabel: account ?? (accountId ? `Account #${accountId}` : '—'),
        categoryLabel:
            category ?? (categoryId ? `Category #${categoryId}` : '—'),
    };
}

export function resolveImportRowReason(row: ImportRowItem): string {
    if (row.error_message) {
        return row.error_message;
    }
    switch (row.status) {
        case 'valid':
            return 'Eligible for import into workspace ledger.';
        case 'imported':
            return 'Imported into workspace ledger.';
        case 'duplicate':
        case 'skipped':
            return 'Matches an existing transaction or earlier row in this batch. Automatically skipped (duplicate override is not supported).';
        case 'invalid':
        case 'failed':
            return 'Validation failed. Row will not be imported.';
        default:
            return 'Pending review.';
    }
}

export function ImportPreviewTable({
    rows,
    accounts = [],
    categories = [],
}: {
    rows?: PaginatedImportRows;
    accounts?: ImportAccountOption[];
    categories?: ImportCategoryOption[];
}) {
    const items = rows?.data ?? [];

    if (items.length === 0) {
        return (
            <EmptyState
                icon={FileSpreadsheet}
                title="No preview rows generated yet"
                description="Configure column mapping, date/amount formats, and workspace references above, then save to inspect row-by-row validation and duplicate checks."
            />
        );
    }

    const pageValidCount = items.filter(
        (r) => r.status === 'valid' || r.status === 'imported',
    ).length;
    const pageDuplicateCount = items.filter(
        (r) => r.status === 'duplicate' || r.status === 'skipped',
    ).length;
    const pageInvalidCount = items.filter(
        (r) => r.status === 'invalid' || r.status === 'failed',
    ).length;

    return (
        <section
            aria-labelledby="import-preview-heading"
            className="overflow-hidden rounded-lg border border-border bg-surface"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
                <div>
                    <h2
                        id="import-preview-heading"
                        className="text-base font-semibold text-foreground"
                    >
                        Row preview, validation & duplicate check
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Only valid rows create transactions. Invalid rows and
                        detected duplicates are preserved in this audit report
                        and never imported. Duplicate override is not supported.
                    </p>
                </div>
                <dl className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-elevated/40 rounded-md border border-border px-2.5 py-1.5">
                        <dt className="inline text-muted-foreground">
                            Eligible on page:{' '}
                        </dt>
                        <dd className="font-numeric inline font-semibold text-income">
                            {pageValidCount}
                        </dd>
                    </div>
                    <div className="bg-elevated/40 rounded-md border border-border px-2.5 py-1.5">
                        <dt className="inline text-muted-foreground">
                            Duplicates on page:{' '}
                        </dt>
                        <dd className="font-numeric inline font-semibold text-warning">
                            {pageDuplicateCount}
                        </dd>
                    </div>
                    <div className="bg-elevated/40 rounded-md border border-border px-2.5 py-1.5">
                        <dt className="inline text-muted-foreground">
                            Invalid / failed on page:{' '}
                        </dt>
                        <dd className="font-numeric inline font-semibold text-destructive">
                            {pageInvalidCount}
                        </dd>
                    </div>
                </dl>
            </div>

            {/* Mobile stacked cards */}
            <ul role="list" className="divide-y divide-border md:hidden">
                {items.map((row) => {
                    const meta = resolveRowTypeMeta(row.normalized_data?.type);
                    const TypeIcon = meta.icon;
                    const amountInfo = formatImportRowAmount(row);
                    const { accountLabel, categoryLabel } =
                        resolveImportRowAccountAndCategory(
                            row,
                            accounts,
                            categories,
                        );
                    const dateValue = row.normalized_data?.transaction_date;
                    const reason = resolveImportRowReason(row);

                    return (
                        <li key={row.id} className="p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-numeric text-xs font-medium text-muted-foreground">
                                        Row #{row.row_number}
                                    </span>
                                    <p className="mt-0.5 font-medium text-foreground">
                                        {row.normalized_data?.description ||
                                            'Missing description'}
                                    </p>
                                </div>
                                <ImportRowStatusBadge status={row.status} />
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Type
                                    </dt>
                                    <dd
                                        className={cn(
                                            'mt-0.5 inline-flex items-center gap-1 font-medium',
                                            meta.className,
                                        )}
                                    >
                                        {TypeIcon && (
                                            <TypeIcon
                                                aria-hidden="true"
                                                className="size-3.5"
                                            />
                                        )}
                                        {meta.label}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Amount
                                    </dt>
                                    <dd
                                        className={cn(
                                            'font-numeric mt-0.5 font-semibold',
                                            amountInfo.className,
                                        )}
                                    >
                                        <span className="sr-only">
                                            {amountInfo.srPrefix}
                                        </span>
                                        {amountInfo.formatted}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Date
                                    </dt>
                                    <dd className="font-numeric mt-0.5">
                                        {dateValue
                                            ? formatDateId(dateValue)
                                            : 'Invalid date'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Account & Category
                                    </dt>
                                    <dd className="mt-0.5">
                                        {accountLabel} • {categoryLabel}
                                    </dd>
                                </div>
                            </dl>
                            <p
                                className={cn(
                                    'mt-3 rounded-md border px-2.5 py-1.5 text-xs',
                                    row.status === 'invalid' ||
                                        row.status === 'failed'
                                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                        : row.status === 'duplicate' ||
                                            row.status === 'skipped'
                                          ? 'border-warning/40 bg-warning/10 text-warning'
                                          : 'bg-elevated/30 border-border text-muted-foreground',
                                )}
                            >
                                {reason}
                            </p>
                        </li>
                    );
                })}
            </ul>

            {/* Desktop table */}
            <div
                role="region"
                tabIndex={0}
                aria-labelledby="import-rows-table-caption"
                className="hidden overflow-x-auto md:block"
            >
                <table className="w-full min-w-[54rem] text-left text-sm">
                    <caption id="import-rows-table-caption" className="sr-only">
                        Normalized transaction import rows, validation messages,
                        and duplicate status
                    </caption>
                    <thead className="bg-elevated/40 border-b border-border text-xs font-medium text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-4 py-3">
                                Row
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Status
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Type
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Date
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Description
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Account / Category
                            </th>
                            <th scope="col" className="px-4 py-3 text-right">
                                Amount
                            </th>
                            <th scope="col" className="px-4 py-3">
                                Validation / Duplicate detail
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((row) => {
                            const meta = resolveRowTypeMeta(
                                row.normalized_data?.type,
                            );
                            const TypeIcon = meta.icon;
                            const amountInfo = formatImportRowAmount(row);
                            const { accountLabel, categoryLabel } =
                                resolveImportRowAccountAndCategory(
                                    row,
                                    accounts,
                                    categories,
                                );
                            const dateValue =
                                row.normalized_data?.transaction_date;
                            const reason = resolveImportRowReason(row);

                            return (
                                <tr
                                    key={row.id}
                                    className="hover:bg-elevated/30 transition"
                                >
                                    <th
                                        scope="row"
                                        className="font-numeric px-4 py-3 font-medium whitespace-nowrap text-muted-foreground"
                                    >
                                        #{row.row_number}
                                    </th>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <ImportRowStatusBadge
                                            status={row.status}
                                        />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1.5 font-medium',
                                                meta.className,
                                            )}
                                        >
                                            {TypeIcon && (
                                                <TypeIcon
                                                    aria-hidden="true"
                                                    className="size-3.5"
                                                />
                                            )}
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="font-numeric px-4 py-3 whitespace-nowrap">
                                        {dateValue
                                            ? formatDateId(dateValue)
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-foreground">
                                        {row.normalized_data?.description ||
                                            '—'}
                                        {row.normalized_data?.notes && (
                                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                                Note:{' '}
                                                {row.normalized_data.notes}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        <div className="font-medium text-foreground">
                                            {accountLabel}
                                        </div>
                                        <div className="text-muted-foreground">
                                            {categoryLabel}
                                        </div>
                                    </td>
                                    <td
                                        className={cn(
                                            'font-numeric px-4 py-3 text-right font-semibold whitespace-nowrap',
                                            amountInfo.className,
                                        )}
                                    >
                                        <span className="sr-only">
                                            {amountInfo.srPrefix}
                                        </span>
                                        {amountInfo.formatted}
                                    </td>
                                    <td
                                        className={cn(
                                            'px-4 py-3 text-xs',
                                            row.status === 'invalid' ||
                                                row.status === 'failed'
                                                ? 'font-medium text-destructive'
                                                : row.status === 'duplicate' ||
                                                    row.status === 'skipped'
                                                  ? 'text-warning'
                                                  : 'text-muted-foreground',
                                        )}
                                    >
                                        {reason}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {rows && rows.last_page > 1 && (
                <nav
                    aria-label="Import row pages"
                    className="flex items-center justify-between border-t border-border p-4"
                >
                    {rows.prev_page_url ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href={rows.prev_page_url}>Previous</Link>
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" disabled>
                            Previous
                        </Button>
                    )}
                    <span className="font-numeric text-xs text-muted-foreground">
                        Page {rows.current_page} of {rows.last_page}
                    </span>
                    {rows.next_page_url ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href={rows.next_page_url}>Next</Link>
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" disabled>
                            Next
                        </Button>
                    )}
                </nav>
            )}
        </section>
    );
}
