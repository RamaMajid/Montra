import { Head, Link, usePoll } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import AlertError from '@/components/alert-error';
import {
    ImportBatchSummaryCard,
    ImportConfirmForm,
} from '@/components/imports/import-batch-summary';
import { ImportMappingForm } from '@/components/imports/import-mapping-form';
import { ImportPreviewTable } from '@/components/imports/import-preview-table';
import {
    ImportStatusBadge,
    ImportWorkflowSteps,
} from '@/components/imports/import-status-badge';
import type {
    ImportAccountOption,
    ImportBatchSummary,
    ImportCategoryOption,
    ImportMappingConfig,
    PaginatedImportRows,
} from '@/components/imports/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import imports from '@/routes/imports';

export type ImportShowProps = {
    batch: ImportBatchSummary & {
        headers?: string[];
        mapping_config?: ImportMappingConfig | null;
    };
    headers?: string[];
    rows?: PaginatedImportRows;
    accounts?: ImportAccountOption[];
    categories?: ImportCategoryOption[];
    canManage?: boolean;
};

export default function ImportShow({
    batch,
    headers,
    rows,
    accounts = [],
    categories = [],
    canManage = false,
}: ImportShowProps) {
    const isProcessing =
        batch.status === 'queued' || batch.status === 'processing';
    const { start, stop } = usePoll(2500, {}, { autoStart: false });

    useEffect(() => {
        if (isProcessing) {
            start();
        } else {
            stop();
        }
    }, [isProcessing, start, stop]);

    const sourceHeaders = headers ?? batch.headers ?? [];
    const canConfigureMapping =
        canManage &&
        (batch.status === 'uploaded' || batch.status === 'previewed');
    const canConfirmBatch = canManage && batch.status === 'previewed';

    return (
        <>
            <Head title={`Import batch #${batch.id}`} />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <div>
                    <Button asChild variant="ghost" size="sm" className="-ml-2">
                        <Link href={imports.index.url()}>
                            <ArrowLeft aria-hidden="true" />
                            Back to import batches
                        </Link>
                    </Button>
                </div>

                <PageHeader
                    eyebrow={`Batch #${batch.id} • ${batch.file_type.toUpperCase()}`}
                    title={batch.original_filename}
                    description="Review column mapping, validation rules, and duplicate checks. Only valid rows are imported upon confirmation."
                    actions={<ImportStatusBadge status={batch.status} />}
                />

                <ImportWorkflowSteps status={batch.status} />

                <ImportBatchSummaryCard batch={batch} />

                {canConfigureMapping && (
                    <ImportMappingForm
                        batchId={batch.id}
                        headers={sourceHeaders}
                        mappingConfig={batch.mapping_config}
                        accounts={accounts}
                        categories={categories}
                    />
                )}

                <ImportPreviewTable
                    rows={rows}
                    accounts={accounts}
                    categories={categories}
                />

                {canConfirmBatch && <ImportConfirmForm batchId={batch.id} />}

                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={[
                            'Enable JavaScript to map columns, preview rows, and confirm transaction imports.',
                        ]}
                    />
                </noscript>
            </main>
        </>
    );
}

ImportShow.layout = {
    breadcrumbs: [{ title: 'Import transactions', href: imports.index.url() }],
};
