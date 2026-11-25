import { Form, Link } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatDateId } from '@/lib/format-currency';
import imports from '@/routes/imports';
import transactions from '@/routes/transactions';
import type { ImportBatchSummary } from './types';

function formatConfirmedAt(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    const isoDate = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return formatDateId(isoDate);
    }
    return value;
}

export function ImportBatchSummaryCard({
    batch,
}: {
    batch: ImportBatchSummary;
}) {
    const isProcessing =
        batch.status === 'queued' || batch.status === 'processing';
    const isFinished =
        batch.status === 'completed' ||
        batch.status === 'completed_with_errors' ||
        batch.status === 'failed';
    const resolvedRows =
        batch.successful_rows + batch.failed_rows + batch.duplicate_rows;
    const confirmedDate = formatConfirmedAt(batch.confirmed_at);

    return (
        <section
            aria-labelledby="import-batch-summary-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2
                        id="import-batch-summary-heading"
                        className="text-base font-semibold text-foreground"
                    >
                        Batch summary
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Batch #{batch.id} • {batch.file_type.toUpperCase()}
                        {confirmedDate ? ` • Confirmed ${confirmedDate}` : ''}
                    </p>
                </div>

                {isFinished && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={imports.index.url()}>
                                Upload another file
                            </Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href={transactions.index.url()}>
                                View workspace transactions
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-elevated/30 rounded-md border border-border p-3.5">
                    <dt className="text-xs text-muted-foreground">
                        Total rows
                    </dt>
                    <dd className="font-numeric mt-1 text-2xl font-semibold text-foreground">
                        {batch.total_rows}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3.5">
                    <dt className="text-xs text-muted-foreground">
                        Imported rows
                    </dt>
                    <dd className="font-numeric mt-1 text-2xl font-semibold text-income">
                        {batch.successful_rows}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3.5">
                    <dt className="text-xs text-muted-foreground">
                        Duplicates skipped
                    </dt>
                    <dd className="font-numeric mt-1 text-2xl font-semibold text-warning">
                        {batch.duplicate_rows}
                    </dd>
                </div>
                <div className="bg-elevated/30 rounded-md border border-border p-3.5">
                    <dt className="text-xs text-muted-foreground">
                        Failed / invalid
                    </dt>
                    <dd className="font-numeric mt-1 text-2xl font-semibold text-destructive">
                        {batch.failed_rows}
                    </dd>
                </div>
            </dl>

            <p role="status" className="mt-4 text-sm text-muted-foreground">
                {isProcessing
                    ? `${batch.status === 'queued' ? 'Batch is queued and waiting for the background queue worker.' : 'Batch is currently processing in background chunks.'} ${resolvedRows} of ${batch.total_rows} rows resolved.`
                    : batch.status === 'completed'
                      ? 'Import completed. Valid rows were recorded in the workspace ledger and account balances were updated on the server.'
                      : batch.status === 'completed_with_errors'
                        ? 'Import completed with errors. Valid rows were imported; review failed and skipped rows in the report below.'
                        : batch.status === 'failed'
                          ? 'Import batch failed. No unverified rows were committed. Upload a corrected file from the Imports page to retry.'
                          : batch.status === 'previewed'
                            ? 'Preview generated. No transactions have been created yet—review the row statuses below and confirm when ready.'
                            : 'File uploaded. Configure column mapping below to validate rows and preview the import.'}
            </p>

            {isProcessing && (
                <div className="mt-3">
                    <label
                        htmlFor="import-batch-progress"
                        className="mb-1 block text-xs text-muted-foreground"
                    >
                        {batch.status === 'queued'
                            ? 'Waiting in queue…'
                            : `Processing rows (${resolvedRows} / ${batch.total_rows})`}
                    </label>
                    <progress
                        id="import-batch-progress"
                        max={batch.total_rows || 1}
                        value={
                            batch.status === 'queued' ? undefined : resolvedRows
                        }
                        className="h-2 w-full accent-primary"
                    >
                        {resolvedRows} of {batch.total_rows} rows
                    </progress>
                </div>
            )}
        </section>
    );
}

export function ImportConfirmForm({
    batchId,
    defaultConfirmed = false,
}: {
    batchId: number;
    defaultConfirmed?: boolean;
}) {
    const [confirmed, setConfirmed] = useState(defaultConfirmed);
    const [requestError, setRequestError] = useState<string | null>(null);

    return (
        <Form
            {...imports.confirm.form(batchId)}
            aria-labelledby="import-confirm-heading"
            className="rounded-lg border border-primary/40 bg-surface p-5 sm:p-6"
            onStart={() => setRequestError(null)}
            onHttpException={() => {
                setRequestError(
                    'Unable to confirm import batch. Verify batch status and try again.',
                );
                return false;
            }}
            onNetworkError={() => {
                setRequestError(
                    'Network error while confirming import batch. Please try again.',
                );
                return false;
            }}
        >
            {({ processing, errors }) => {
                const otherErrors = Object.entries(errors)
                    .filter(([key]) => key !== 'confirmed')
                    .map(([, msg]) => msg);

                return (
                    <div>
                        <h2
                            id="import-confirm-heading"
                            className="text-base font-semibold text-foreground"
                        >
                            Confirm and queue import
                        </h2>
                        <p
                            id="import-confirm-help"
                            className="mt-1 text-sm text-muted-foreground"
                        >
                            Only rows marked Valid will create transactions in
                            this workspace. Invalid rows and detected duplicate
                            rows will be skipped and retained in the batch audit
                            report.
                        </p>

                        {(requestError || otherErrors.length > 0) && (
                            <div className="mt-4">
                                <AlertError
                                    title="Confirmation error"
                                    errors={[
                                        ...(requestError ? [requestError] : []),
                                        ...otherErrors,
                                    ]}
                                />
                            </div>
                        )}

                        <div className="mt-4 flex items-start gap-3">
                            <input
                                id="import-confirm-checkbox"
                                type="checkbox"
                                name="confirmed"
                                value="1"
                                required
                                checked={confirmed}
                                onChange={(event) =>
                                    setConfirmed(event.target.checked)
                                }
                                aria-invalid={Boolean(errors.confirmed)}
                                aria-describedby={
                                    errors.confirmed
                                        ? 'import-confirm-help import-confirm-error'
                                        : 'import-confirm-help'
                                }
                                className="mt-0.5 size-5 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            />
                            <Label
                                htmlFor="import-confirm-checkbox"
                                className="cursor-pointer text-sm leading-6 text-foreground"
                            >
                                I have reviewed the column mapping, validation
                                errors, and skipped duplicates. Queue valid rows
                                for import into this workspace.
                            </Label>
                        </div>

                        <InputError
                            id="import-confirm-error"
                            message={errors.confirmed}
                        />

                        <div className="mt-5">
                            <Button
                                type="submit"
                                disabled={processing || !confirmed}
                            >
                                {processing && <Spinner />}
                                {processing
                                    ? 'Queuing import batch…'
                                    : 'Confirm and queue import'}
                            </Button>
                        </div>
                    </div>
                );
            }}
        </Form>
    );
}
