import { Head } from '@inertiajs/react';
import AlertError from '@/components/alert-error';
import {
    ImportHistoryList,
    ImportHistorySkeleton,
} from '@/components/imports/import-history-list';
import { ImportStatusBadge } from '@/components/imports/import-status-badge';
import { ImportUploadForm } from '@/components/imports/import-upload-form';
import type {
    ImportBatchSummary,
    PaginatedImportBatches,
} from '@/components/imports/types';
import { PageHeader } from '@/components/page-header';
import imports from '@/routes/imports';

export type { ImportBatchSummary };
export type PaginatedBatches = PaginatedImportBatches;

export function getStatusBadge(status: string) {
    return <ImportStatusBadge status={status} />;
}

export type ImportsIndexProps = {
    batches?: PaginatedImportBatches;
    filters?: {
        status?: string;
    };
    canManage?: boolean;
    canUpload?: boolean;
};

export function ImportsUploadSection({ canUpload }: { canUpload: boolean }) {
    if (canUpload) {
        return <ImportUploadForm />;
    }

    return (
        <section
            aria-label="Read-only import access"
            className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground"
        >
            You have view-only access in this workspace. You can inspect
            historical import batches and audit reports below, while workspace
            members, admins, and owners can upload and confirm new batches.
        </section>
    );
}

export default function ImportsIndex({
    batches,
    filters = {},
    canManage,
    canUpload,
}: ImportsIndexProps) {
    const allowedToUpload = Boolean(canUpload ?? canManage);

    return (
        <>
            <Head title="Transaction Imports" />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Workspace"
                    title="Import transactions"
                    description="Safely bring in CSV or XLSX bank and wallet statements. Map columns, inspect row validation and duplicate indicators, and confirm before any transactions are created."
                />

                <ImportsUploadSection canUpload={allowedToUpload} />

                {batches ? (
                    <ImportHistoryList
                        batches={batches}
                        statusFilter={filters.status ?? ''}
                    />
                ) : (
                    <ImportHistorySkeleton />
                )}

                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={[
                            'Enable JavaScript to upload files and manage transaction import batches.',
                        ]}
                    />
                </noscript>
            </main>
        </>
    );
}

ImportsIndex.layout = {
    breadcrumbs: [{ title: 'Import transactions', href: imports.index.url() }],
};
