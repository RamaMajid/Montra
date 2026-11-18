import { Form, Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    FileUp,
    RefreshCw,
    UploadCloud,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ImportBatchSummary = {
    id: number;
    original_filename: string;
    file_type: string;
    status:
        | 'uploaded'
        | 'previewed'
        | 'queued'
        | 'processing'
        | 'completed'
        | 'completed_with_errors'
        | 'failed';
    total_rows: number;
    successful_rows: number;
    failed_rows: number;
    duplicate_rows: number;
    confirmed_at?: string | null;
    created_at?: string;
    updated_at?: string;
};

export type PaginatedBatches = {
    data: ImportBatchSummary[];
    current_page: number;
    last_page: number;
    per_page?: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
};

type Props = {
    batches?: PaginatedBatches;
    filters?: {
        status?: string;
    };
    canManage?: boolean;
    canUpload?: boolean;
};

export function getStatusBadge(status: string) {
    switch (status) {
        case 'completed':
            return (
                <Badge
                    variant="outline"
                    className="border-emerald-600/40 bg-emerald-500/10 text-emerald-400"
                >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Completed
                </Badge>
            );
        case 'completed_with_errors':
            return (
                <Badge
                    variant="outline"
                    className="border-amber-600/40 bg-amber-500/10 text-amber-400"
                >
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Completed with errors
                </Badge>
            );
        case 'queued':
        case 'processing':
            return (
                <Badge
                    variant="outline"
                    className="border-sky-600/40 bg-sky-500/10 text-sky-400"
                >
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    {status === 'queued' ? 'Queued' : 'Processing'}
                </Badge>
            );
        case 'previewed':
            return (
                <Badge
                    variant="outline"
                    className="border-blue-600/40 bg-blue-500/10 text-blue-400"
                >
                    <Clock className="mr-1 h-3 w-3" />
                    Previewed
                </Badge>
            );
        case 'failed':
            return (
                <Badge
                    variant="outline"
                    className="border-rose-600/40 bg-rose-500/10 text-rose-400"
                >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Failed
                </Badge>
            );
        default:
            return (
                <Badge
                    variant="outline"
                    className="border-muted-foreground/30 text-muted-foreground"
                >
                    <Clock className="mr-1 h-3 w-3" />
                    Uploaded
                </Badge>
            );
    }
}

export default function ImportsIndex({
    batches,
    filters = {},
    canUpload = false,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');

    const handleFileChange = (file?: File) => {
        if (!file) return;
        if (!/\.(csv|xlsx)$/i.test(file.name)) {
            alert('Please select a valid CSV or XLSX file.');
            return;
        }
        setSelectedFile(file);
        if (fileInputRef.current) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInputRef.current.files = dataTransfer.files;
        }
    };

    const clearSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFilterChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        router.get('/imports', newStatus ? { status: newStatus } : {}, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Imports', href: '/imports' }]}>
            <Head title="Transaction Imports" />
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 sm:p-6">
                {/* Header */}
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-emerald-500">
                            Transaction history
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Import transactions
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Safely bring in CSV or XLSX bank and wallet
                            statements. Map columns, inspect row validation and
                            duplicate indicators, and confirm before any
                            transactions are created.
                        </p>
                    </div>
                </header>

                {/* File Upload Section */}
                {canUpload && (
                    <section
                        aria-labelledby="upload-heading"
                        className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
                    >
                        <div className="flex items-center gap-2">
                            <FileUp className="h-5 w-5 text-emerald-500" />
                            <h2
                                id="upload-heading"
                                className="text-lg font-medium text-foreground"
                            >
                                Upload transaction file
                            </h2>
                        </div>
                        <p
                            id="upload-instructions"
                            className="mt-1 text-sm text-muted-foreground"
                        >
                            Upload a CSV or XLSX file up to 10 MB. Files are
                            stored securely and privately in workspace storage.
                        </p>

                        {/* Single semantic form with visible native file control */}
                        <Form
                            id="import-upload-form"
                            action="/imports"
                            method="post"
                            encType="multipart/form-data"
                            className="mt-4"
                            onSuccess={clearSelectedFile}
                        >
                            {({ errors, processing, progress }) => (
                                <div className="flex flex-col gap-3">
                                    <div
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setIsDragging(true);
                                        }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            if (e.dataTransfer.files?.[0]) {
                                                handleFileChange(
                                                    e.dataTransfer.files[0],
                                                );
                                            }
                                        }}
                                        className={cn(
                                            'flex min-h-36 flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition focus-within:ring-2 focus-within:ring-ring',
                                            isDragging
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : 'border-border bg-muted/20 hover:border-emerald-600 hover:bg-muted/40',
                                        )}
                                    >
                                        <UploadCloud className="mb-2 h-8 w-8 text-emerald-500" />
                                        <Label
                                            htmlFor="file-input"
                                            className="cursor-pointer text-sm font-medium text-foreground"
                                        >
                                            Select CSV or XLSX file or drag and
                                            drop here
                                        </Label>
                                        <span className="mt-1 text-xs text-muted-foreground">
                                            Supported formats: .csv, .xlsx
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            id="file-input"
                                            name="file"
                                            type="file"
                                            accept=".csv,.xlsx"
                                            aria-invalid={Boolean(errors.file)}
                                            aria-describedby={
                                                errors.file
                                                    ? 'upload-instructions file-error'
                                                    : 'upload-instructions'
                                            }
                                            className="mt-3 block w-full max-w-xs cursor-pointer rounded-md text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            onChange={(e) =>
                                                handleFileChange(
                                                    e.target.files?.[0],
                                                )
                                            }
                                        />
                                    </div>

                                    {selectedFile && (
                                        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-500" />
                                                <span className="truncate font-medium text-foreground">
                                                    {selectedFile.name}
                                                </span>
                                                <span className="text-xs whitespace-nowrap text-muted-foreground">
                                                    (
                                                    {(
                                                        selectedFile.size / 1024
                                                    ).toFixed(1)}{' '}
                                                    KB)
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                aria-label={`Remove selected file ${selectedFile.name}`}
                                                onClick={clearSelectedFile}
                                                className="h-8 w-8 p-0"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                    {progress && (
                                        <div className="mt-1">
                                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                                <span>Uploading file…</span>
                                                <span>
                                                    {progress.percentage}%
                                                </span>
                                            </div>
                                            <progress
                                                value={progress.percentage ?? 0}
                                                max={100}
                                                className="w-full accent-emerald-600"
                                                aria-label={`Upload progress: ${progress.percentage}%`}
                                            />
                                        </div>
                                    )}

                                    <InputError
                                        id="file-error"
                                        message={errors.file}
                                    />

                                    <div className="flex items-center gap-2 pt-1">
                                        <Button
                                            type="submit"
                                            disabled={
                                                !selectedFile || processing
                                            }
                                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                                        >
                                            {processing
                                                ? 'Uploading and inspecting…'
                                                : 'Upload and configure mapping'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Form>
                    </section>
                )}

                {/* Import History Table */}
                <section
                    aria-labelledby="history-heading"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
                        <div>
                            <h2
                                id="history-heading"
                                className="text-lg font-medium text-foreground"
                            >
                                Import history
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Previous batch runs and audit records.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="filter-status"
                                className="text-xs text-muted-foreground"
                            >
                                Filter status:
                            </Label>
                            <select
                                id="filter-status"
                                value={statusFilter}
                                onChange={(e) =>
                                    handleFilterChange(e.target.value)
                                }
                                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <option value="">All statuses</option>
                                <option value="uploaded">Uploaded</option>
                                <option value="previewed">Previewed</option>
                                <option value="queued">Queued</option>
                                <option value="processing">Processing</option>
                                <option value="completed">Completed</option>
                                <option value="completed_with_errors">
                                    Completed with errors
                                </option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                    </div>

                    {!batches?.data || batches.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/60" />
                            <h3 className="text-base font-medium text-foreground">
                                No import batches found
                            </h3>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                {statusFilter
                                    ? 'No batches match the selected status filter.'
                                    : 'Upload a CSV or XLSX file above to start importing transaction history.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <caption className="sr-only">
                                    Historical transaction import batches
                                </caption>
                                <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">
                                            File
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Status
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            Total
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
                                <tbody className="divide-y divide-border/60">
                                    {batches.data.map((batch) => (
                                        <tr
                                            key={batch.id}
                                            className="group transition hover:bg-muted/30"
                                        >
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/imports/${batch.id}`}
                                                    className="flex items-center gap-1.5 font-medium text-foreground hover:text-emerald-500 hover:underline"
                                                >
                                                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                                                    <span className="max-w-xs truncate">
                                                        {
                                                            batch.original_filename
                                                        }
                                                    </span>
                                                </Link>
                                                <span className="text-xs text-muted-foreground">
                                                    Batch #{batch.id}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {getStatusBadge(batch.status)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs">
                                                {batch.total_rows}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-emerald-500">
                                                {batch.successful_rows}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-amber-500">
                                                {batch.duplicate_rows}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-rose-400">
                                                {batch.failed_rows}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs text-emerald-500 hover:text-emerald-400"
                                                >
                                                    <Link
                                                        href={`/imports/${batch.id}`}
                                                    >
                                                        View batch →
                                                    </Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {batches && batches.last_page > 1 && (
                        <nav
                            aria-label="Import history pages"
                            className="flex items-center justify-between border-t border-border p-4"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!batches.prev_page_url}
                                asChild={Boolean(batches.prev_page_url)}
                            >
                                {batches.prev_page_url ? (
                                    <Link href={batches.prev_page_url}>
                                        Previous
                                    </Link>
                                ) : (
                                    <span>Previous</span>
                                )}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Page {batches.current_page} of{' '}
                                {batches.last_page} ({batches.total} total)
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!batches.next_page_url}
                                asChild={Boolean(batches.next_page_url)}
                            >
                                {batches.next_page_url ? (
                                    <Link href={batches.next_page_url}>
                                        Next
                                    </Link>
                                ) : (
                                    <span>Next</span>
                                )}
                            </Button>
                        </nav>
                    )}
                </section>
            </main>
        </AppLayout>
    );
}
