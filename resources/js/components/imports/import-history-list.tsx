import { Link, router } from '@inertiajs/react';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import imports from '@/routes/imports';
import { ImportStatusBadge } from './import-status-badge';
import {
    importBatchStatusOptions,
    type ImportBatchStatus,
    type PaginatedImportBatches,
} from './types';

export function buildImportBatchQuery(status?: string): { status?: string } {
    if (
        status &&
        importBatchStatusOptions.some((option) => option.value === status)
    ) {
        return { status };
    }
    return {};
}

export function ImportHistoryList({
    batches,
    statusFilter = '',
}: {
    batches?: PaginatedImportBatches;
    statusFilter?: string;
}) {
    const [selectedStatus, setSelectedStatus] = useState(statusFilter);

    const applyFilter = (nextStatus: string) => {
        setSelectedStatus(nextStatus);
        router.get(imports.index.url(), buildImportBatchQuery(nextStatus), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const items = batches?.data ?? [];

    return (
        <section
            aria-labelledby="import-history-heading"
            className="overflow-hidden rounded-lg border border-border bg-surface"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
                <div>
                    <h2
                        id="import-history-heading"
                        className="text-base font-semibold text-foreground"
                    >
                        Import batches
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Audit trail of workspace file uploads, previews, and
                        processed batches.
                    </p>
                </div>

                <search>
                    <form
                        action={imports.index.url()}
                        method="get"
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyFilter(selectedStatus);
                        }}
                        className="flex flex-wrap items-center gap-2"
                    >
                        <Label
                            htmlFor="import-status-filter"
                            className="text-xs text-muted-foreground"
                        >
                            Status
                        </Label>
                        <select
                            id="import-status-filter"
                            name="status"
                            value={selectedStatus}
                            onChange={(event) =>
                                setSelectedStatus(event.target.value)
                            }
                            className="h-10 rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-xs"
                        >
                            <option value="">All statuses</option>
                            {importBatchStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">
                            Filter
                        </Button>
                        {selectedStatus && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => applyFilter('')}
                            >
                                Clear
                            </Button>
                        )}
                    </form>
                </search>
            </div>

            {items.length === 0 ? (
                <div className="p-6">
                    <EmptyState
                        icon={FileSpreadsheet}
                        title="No import batches found"
                        description={
                            selectedStatus
                                ? 'No import batches match the selected status filter.'
                                : 'Upload a CSV or XLSX transaction statement above to configure mapping and preview rows.'
                        }
                    />
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <ul
                        role="list"
                        className="divide-y divide-border md:hidden"
                    >
                        {items.map((batch) => (
                            <li key={batch.id} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link
                                            href={imports.show.url(batch.id)}
                                            className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                                        >
                                            {batch.original_filename}
                                        </Link>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            Batch #{batch.id} •{' '}
                                            {batch.file_type.toUpperCase()}
                                        </p>
                                    </div>
                                    <ImportStatusBadge
                                        status={
                                            batch.status as ImportBatchStatus
                                        }
                                    />
                                </div>
                                <dl className="bg-elevated/30 mt-3 grid grid-cols-4 gap-2 rounded-md border border-border/70 p-2.5 text-xs">
                                    <div>
                                        <dt className="text-muted-foreground">
                                            Total
                                        </dt>
                                        <dd className="font-numeric mt-0.5 font-semibold">
                                            {batch.total_rows}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground">
                                            Imported
                                        </dt>
                                        <dd className="font-numeric mt-0.5 font-semibold text-income">
                                            {batch.successful_rows}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground">
                                            Duplicates
                                        </dt>
                                        <dd className="font-numeric mt-0.5 font-semibold text-warning">
                                            {batch.duplicate_rows}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted-foreground">
                                            Failed
                                        </dt>
                                        <dd className="font-numeric mt-0.5 font-semibold text-destructive">
                                            {batch.failed_rows}
                                        </dd>
                                    </div>
                                </dl>
                                <div className="mt-3 flex justify-end">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={imports.show.url(batch.id)}>
                                            View batch
                                            <span className="sr-only">
                                                {' '}
                                                #{batch.id}{' '}
                                                {batch.original_filename}
                                            </span>
                                        </Link>
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {/* Desktop table */}
                    <div
                        role="region"
                        tabIndex={0}
                        aria-labelledby="import-batches-table-caption"
                        className="hidden overflow-x-auto md:block"
                    >
                        <table className="w-full min-w-[44rem] text-left text-sm">
                            <caption
                                id="import-batches-table-caption"
                                className="sr-only"
                            >
                                Workspace transaction import batches
                            </caption>
                            <thead className="bg-elevated/40 border-b border-border text-xs font-medium text-muted-foreground">
                                <tr>
                                    <th scope="col" className="px-4 py-3">
                                        File & batch
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right"
                                    >
                                        Total rows
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right"
                                    >
                                        Imported
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right"
                                    >
                                        Duplicates
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right"
                                    >
                                        Failed
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right"
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map((batch) => (
                                    <tr
                                        key={batch.id}
                                        className="hover:bg-elevated/30 transition"
                                    >
                                        <th
                                            scope="row"
                                            className="px-4 py-3 font-normal"
                                        >
                                            <Link
                                                href={imports.show.url(
                                                    batch.id,
                                                )}
                                                className="flex items-center gap-2 font-medium text-foreground hover:text-primary hover:underline"
                                            >
                                                <FileSpreadsheet
                                                    aria-hidden="true"
                                                    className="size-4 shrink-0 text-primary"
                                                />
                                                <span className="max-w-xs truncate">
                                                    {batch.original_filename}
                                                </span>
                                            </Link>
                                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                                Batch #{batch.id} •{' '}
                                                {batch.file_type.toUpperCase()}
                                            </span>
                                        </th>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <ImportStatusBadge
                                                status={batch.status}
                                            />
                                        </td>
                                        <td className="font-numeric px-4 py-3 text-right">
                                            {batch.total_rows}
                                        </td>
                                        <td className="font-numeric px-4 py-3 text-right text-income">
                                            {batch.successful_rows}
                                        </td>
                                        <td className="font-numeric px-4 py-3 text-right text-warning">
                                            {batch.duplicate_rows}
                                        </td>
                                        <td className="font-numeric px-4 py-3 text-right text-destructive">
                                            {batch.failed_rows}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Link
                                                    href={imports.show.url(
                                                        batch.id,
                                                    )}
                                                >
                                                    View batch
                                                    <span className="sr-only">
                                                        {' '}
                                                        #{batch.id}{' '}
                                                        {
                                                            batch.original_filename
                                                        }
                                                    </span>
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {batches && batches.last_page > 1 && (
                        <nav
                            aria-label="Import batch pages"
                            className="flex items-center justify-between border-t border-border p-4"
                        >
                            {batches.prev_page_url ? (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={batches.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled>
                                    Previous
                                </Button>
                            )}
                            <span className="font-numeric text-xs text-muted-foreground">
                                Page {batches.current_page} of{' '}
                                {batches.last_page} ({batches.total} total)
                            </span>
                            {batches.next_page_url ? (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={batches.next_page_url}>
                                        Next
                                    </Link>
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled>
                                    Next
                                </Button>
                            )}
                        </nav>
                    )}
                </>
            )}
        </section>
    );
}

export function ImportHistorySkeleton() {
    return (
        <div
            role="status"
            aria-label="Loading import batches"
            className="space-y-3 rounded-lg border border-border bg-surface p-5"
        >
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
    );
}
