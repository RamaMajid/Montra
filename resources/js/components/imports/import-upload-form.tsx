import { Form } from '@inertiajs/react';
import { FileSpreadsheet, FileUp, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import imports from '@/routes/imports';

const MAX_UPLOAD_BYTES = 10240 * 1024; // 10240 KB (ImportUploadRequest max:10240)

export function validateImportFile(
    file: Pick<File, 'name' | 'size'> | null | undefined,
): string | null {
    if (!file) {
        return 'Select a CSV or XLSX file to upload.';
    }
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
        return 'Only CSV (.csv) and Excel (.xlsx) files are supported.';
    }
    if (file.size <= 0) {
        return 'Selected file is empty.';
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return 'File exceeds the 10 MB (10,240 KB) maximum size.';
    }
    return null;
}

export type ImportUploadFormProps = {
    initialFileName?: string;
    initialFileSize?: number;
};

export function ImportUploadForm({
    initialFileName,
    initialFileSize,
}: ImportUploadFormProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{
        name: string;
        size: number;
    } | null>(
        initialFileName
            ? { name: initialFileName, size: initialFileSize ?? 1024 }
            : null,
    );
    const [clientError, setClientError] = useState<string | null>(null);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const clearSelectedFile = () => {
        setSelectedFile(null);
        setClientError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (file?: File, assignToInput = false) => {
        setRequestError(null);
        if (!file) {
            clearSelectedFile();
            return;
        }
        const validationError = validateImportFile(file);
        if (validationError) {
            setSelectedFile(null);
            setClientError(validationError);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }
        setClientError(null);
        setSelectedFile({ name: file.name, size: file.size });
        if (
            assignToInput &&
            fileInputRef.current &&
            typeof DataTransfer !== 'undefined'
        ) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInputRef.current.files = dataTransfer.files;
        }
    };

    return (
        <section
            aria-labelledby="import-upload-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
            <div className="flex items-center gap-2.5">
                <FileUp aria-hidden="true" className="size-5 text-primary" />
                <h2
                    id="import-upload-heading"
                    className="text-base font-semibold text-foreground"
                >
                    Upload transaction file
                </h2>
            </div>
            <p
                id="import-upload-instructions"
                className="mt-1 text-sm text-muted-foreground"
            >
                Supported formats: CSV (.csv) and Excel (.xlsx) up to 10 MB
                (10,240 KB). Legacy .xls files are not supported. Row 1 must
                contain column headers, and no transactions are created until
                you map columns, review the preview, and confirm.
            </p>

            {requestError && (
                <div className="mt-4">
                    <AlertError title="Upload failed" errors={[requestError]} />
                </div>
            )}

            <Form
                {...imports.store.form()}
                encType="multipart/form-data"
                aria-labelledby="import-upload-heading"
                className="mt-4"
                onStart={() => setRequestError(null)}
                onSuccess={clearSelectedFile}
                onHttpException={() => {
                    setRequestError(
                        'Unable to upload file. Verify the file format and try again.',
                    );
                    return false;
                }}
                onNetworkError={() => {
                    setRequestError(
                        'Network error while uploading file. Check your connection and try again.',
                    );
                    return false;
                }}
            >
                {({ errors, processing, progress }) => {
                    const fileError = clientError ?? errors.file;
                    const progressPercent = progress?.percentage ?? 0;

                    return (
                        <div className="flex flex-col gap-4">
                            <div
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setIsDragging(false);
                                    const dropped =
                                        event.dataTransfer.files?.[0];
                                    if (dropped) {
                                        handleFileChange(dropped, true);
                                    }
                                }}
                                className={cn(
                                    'flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center transition focus-within:ring-2 focus-within:ring-ring',
                                    isDragging
                                        ? 'border-primary bg-primary/10'
                                        : 'bg-elevated/30 border-border hover:border-primary/60',
                                )}
                            >
                                <UploadCloud
                                    aria-hidden="true"
                                    className="mb-2 size-7 text-primary"
                                />
                                <Label
                                    htmlFor="import-file-input"
                                    className="cursor-pointer text-sm font-medium text-foreground"
                                >
                                    Choose a CSV or XLSX file, or drag and drop
                                    it here{' '}
                                    <span
                                        aria-hidden="true"
                                        className="text-destructive"
                                    >
                                        *
                                    </span>
                                </Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Private workspace storage • Max 10 MB • Max
                                    100,000 data rows
                                </p>
                                <input
                                    ref={fileInputRef}
                                    id="import-file-input"
                                    name="file"
                                    type="file"
                                    required
                                    accept=".csv,.xlsx"
                                    aria-invalid={Boolean(fileError)}
                                    aria-describedby={
                                        fileError
                                            ? 'import-upload-instructions import-file-error'
                                            : 'import-upload-instructions'
                                    }
                                    onChange={(event) =>
                                        handleFileChange(
                                            event.target.files?.[0],
                                            false,
                                        )
                                    }
                                    className="mt-3 block w-full max-w-xs cursor-pointer rounded-md text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                />
                            </div>

                            {selectedFile && (
                                <div className="bg-elevated/40 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3.5 py-2.5 text-sm">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <FileSpreadsheet
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-primary"
                                        />
                                        <span className="truncate font-medium text-foreground">
                                            {selectedFile.name}
                                        </span>
                                        <span className="font-numeric text-xs whitespace-nowrap text-muted-foreground">
                                            (
                                            {Math.max(
                                                1,
                                                Math.round(
                                                    selectedFile.size / 1024,
                                                ),
                                            )}{' '}
                                            KB)
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSelectedFile}
                                        disabled={processing}
                                    >
                                        <X aria-hidden="true" />
                                        Remove file
                                        <span className="sr-only">
                                            {' '}
                                            {selectedFile.name}
                                        </span>
                                    </Button>
                                </div>
                            )}

                            {progress && (
                                <div>
                                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                        <label htmlFor="import-upload-progress">
                                            Uploading file…
                                        </label>
                                        <span className="font-numeric">
                                            {progressPercent}%
                                        </span>
                                    </div>
                                    <progress
                                        id="import-upload-progress"
                                        value={progressPercent}
                                        max={100}
                                        className="h-2 w-full accent-primary"
                                    >
                                        {progressPercent}%
                                    </progress>
                                </div>
                            )}

                            <InputError
                                id="import-file-error"
                                message={fileError ?? undefined}
                            />

                            <div className="flex items-center gap-3">
                                <Button
                                    type="submit"
                                    disabled={
                                        processing || Boolean(clientError)
                                    }
                                >
                                    {processing && <Spinner />}
                                    {processing
                                        ? 'Uploading file…'
                                        : 'Upload and continue to mapping'}
                                </Button>
                            </div>
                        </div>
                    );
                }}
            </Form>
        </section>
    );
}
