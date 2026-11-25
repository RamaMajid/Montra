import { Form } from '@inertiajs/react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import imports from '@/routes/imports';
import type {
    ImportAccountOption,
    ImportCategoryOption,
    ImportMappingConfig,
} from './types';

export const importColumnFields = [
    { key: 'description', label: 'Description', required: true },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'date', label: 'Transaction date', required: true },
    { key: 'type', label: 'Transaction type', required: true },
    { key: 'notes', label: 'Notes', required: false },
] as const;

export const importDateFormatOptions = [
    { value: 'Y-m-d', label: 'YYYY-MM-DD (2026-11-18)' },
    { value: 'd/m/Y', label: 'DD/MM/YYYY (18/11/2026)' },
    { value: 'm/d/Y', label: 'MM/DD/YYYY (11/18/2026)' },
    { value: 'd-m-Y', label: 'DD-MM-YYYY (18-11-2026)' },
] as const;

export const importAmountFormatOptions = [
    { value: 'raw', label: 'Integer Rupiah (50000)' },
    { value: 'idr_dot', label: 'Dot thousands (50.000 or 50.000,00)' },
    { value: 'idr_comma', label: 'Comma thousands (50,000 or 50,000.00)' },
] as const;

export const importRelationshipFields = [
    {
        key: 'account_id',
        label: 'Income / expense account',
        hint: 'Required for income and expense rows.',
        source: 'accounts',
    },
    {
        key: 'category_id',
        label: 'Income / expense category',
        hint: 'Required for income and expense rows (must match row type).',
        source: 'categories',
    },
    {
        key: 'source_account_id',
        label: 'Transfer source account',
        hint: 'Required for transfer rows.',
        source: 'accounts',
    },
    {
        key: 'destination_account_id',
        label: 'Transfer destination account',
        hint: 'Required for transfer rows (must differ from source).',
        source: 'accounts',
    },
] as const;

const selectClass =
    'mt-1.5 h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:text-sm';

export function ImportMappingForm({
    batchId,
    headers,
    mappingConfig,
    accounts,
    categories,
    onPreviewSuccess,
}: {
    batchId: number;
    headers: string[];
    mappingConfig?: ImportMappingConfig | null;
    accounts: ImportAccountOption[];
    categories: ImportCategoryOption[];
    onPreviewSuccess?: () => void;
}) {
    const [requestError, setRequestError] = useState<string | null>(null);
    const [selectedCols, setSelectedCols] = useState<Record<string, string>>({
        description:
            mappingConfig?.description !== undefined &&
            mappingConfig?.description !== null
                ? String(mappingConfig.description)
                : '',
        amount:
            mappingConfig?.amount !== undefined &&
            mappingConfig?.amount !== null
                ? String(mappingConfig.amount)
                : '',
        date:
            mappingConfig?.date !== undefined && mappingConfig?.date !== null
                ? String(mappingConfig.date)
                : '',
        type:
            mappingConfig?.type !== undefined && mappingConfig?.type !== null
                ? String(mappingConfig.type)
                : '',
        notes:
            mappingConfig?.notes !== undefined && mappingConfig?.notes !== null
                ? String(mappingConfig.notes)
                : '',
    });
    const [sourceAccountId, setSourceAccountId] = useState<string>(
        mappingConfig?.source_account_id
            ? String(mappingConfig.source_account_id)
            : '',
    );
    const [destinationAccountId, setDestinationAccountId] = useState<string>(
        mappingConfig?.destination_account_id
            ? String(mappingConfig.destination_account_id)
            : '',
    );

    const usedIndexes = Object.values(selectedCols).filter((val) => val !== '');
    const hasDuplicateColumns =
        new Set(usedIndexes).size !== usedIndexes.length;
    const sameTransferAccounts =
        sourceAccountId !== '' &&
        destinationAccountId !== '' &&
        sourceAccountId === destinationAccountId;

    return (
        <Form
            {...imports.preview.form(batchId)}
            aria-labelledby="import-mapping-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
            onStart={() => setRequestError(null)}
            onSuccess={() => onPreviewSuccess?.()}
            onHttpException={() => {
                setRequestError(
                    'Unable to generate preview. Verify your column mapping and try again.',
                );
                return false;
            }}
            onNetworkError={() => {
                setRequestError(
                    'Network error while generating preview. Please try again.',
                );
                return false;
            }}
        >
            {({ errors, processing }) => {
                const errorEntries = Object.entries(errors);
                return (
                    <div>
                        <h2
                            id="import-mapping-heading"
                            className="text-base font-semibold text-foreground"
                        >
                            Column mapping and formats
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Map your file columns (0-based column index from row
                            1 headers), select date and Rupiah amount formats,
                            and assign active workspace accounts and categories.
                        </p>

                        {(requestError || errorEntries.length > 0) && (
                            <div className="mt-4">
                                <AlertError
                                    title="Mapping validation failed"
                                    errors={[
                                        ...(requestError ? [requestError] : []),
                                        ...errorEntries.map(([, msg]) => msg),
                                    ]}
                                />
                            </div>
                        )}

                        {hasDuplicateColumns && (
                            <p
                                role="status"
                                className="mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
                            >
                                Multiple transaction fields are mapped to the
                                same file column. Verify that this is
                                intentional before previewing.
                            </p>
                        )}

                        {sameTransferAccounts && (
                            <p
                                role="alert"
                                className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                            >
                                Transfer source and destination accounts must be
                                different for transfer rows to validate.
                            </p>
                        )}

                        <fieldset className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <legend className="text-sm font-medium text-foreground">
                                File column mapping
                            </legend>
                            {importColumnFields.map((field) => {
                                const errorMsg = errors[`mapping.${field.key}`];
                                const inputId = `mapping-${field.key}`;
                                const errorId = `${inputId}-error`;
                                return (
                                    <div key={field.key}>
                                        <Label htmlFor={inputId}>
                                            {field.label}{' '}
                                            {field.required ? (
                                                <span
                                                    aria-hidden="true"
                                                    className="text-destructive"
                                                >
                                                    *
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    (optional)
                                                </span>
                                            )}
                                        </Label>
                                        <select
                                            id={inputId}
                                            name={`mapping[${field.key}]`}
                                            required={field.required}
                                            value={selectedCols[field.key]}
                                            onChange={(event) =>
                                                setSelectedCols((prev) => ({
                                                    ...prev,
                                                    [field.key]:
                                                        event.target.value,
                                                }))
                                            }
                                            aria-invalid={Boolean(errorMsg)}
                                            aria-describedby={
                                                errorMsg ? errorId : undefined
                                            }
                                            className={selectClass}
                                        >
                                            <option value="">
                                                {field.required
                                                    ? 'Select file column'
                                                    : 'Not mapped'}
                                            </option>
                                            {headers.map((header, index) => (
                                                <option
                                                    key={`${header}-${index}`}
                                                    value={index}
                                                >
                                                    Column {index + 1}:{' '}
                                                    {header || 'Unnamed column'}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            id={errorId}
                                            message={errorMsg}
                                        />
                                    </div>
                                );
                            })}
                        </fieldset>

                        <fieldset className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                            <legend className="text-sm font-medium text-foreground">
                                Date & IDR amount parsing
                            </legend>
                            <div>
                                <Label htmlFor="mapping-date-format">
                                    Date format{' '}
                                    <span
                                        aria-hidden="true"
                                        className="text-destructive"
                                    >
                                        *
                                    </span>
                                </Label>
                                <select
                                    id="mapping-date-format"
                                    name="mapping[date_format]"
                                    required
                                    defaultValue={
                                        mappingConfig?.date_format ?? 'Y-m-d'
                                    }
                                    aria-invalid={Boolean(
                                        errors['mapping.date_format'],
                                    )}
                                    aria-describedby={
                                        errors['mapping.date_format']
                                            ? 'mapping-date-format-error'
                                            : undefined
                                    }
                                    className={selectClass}
                                >
                                    {importDateFormatOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    id="mapping-date-format-error"
                                    message={errors['mapping.date_format']}
                                />
                            </div>

                            <div>
                                <Label htmlFor="mapping-amount-format">
                                    IDR amount format{' '}
                                    <span
                                        aria-hidden="true"
                                        className="text-destructive"
                                    >
                                        *
                                    </span>
                                </Label>
                                <select
                                    id="mapping-amount-format"
                                    name="mapping[amount_format]"
                                    required
                                    defaultValue={
                                        mappingConfig?.amount_format ?? 'raw'
                                    }
                                    aria-invalid={Boolean(
                                        errors['mapping.amount_format'],
                                    )}
                                    aria-describedby={
                                        errors['mapping.amount_format']
                                            ? 'mapping-amount-format-error'
                                            : undefined
                                    }
                                    className={selectClass}
                                >
                                    {importAmountFormatOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    id="mapping-amount-format-error"
                                    message={errors['mapping.amount_format']}
                                />
                            </div>
                        </fieldset>

                        <fieldset className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                            <legend className="text-sm font-medium text-foreground">
                                Active workspace accounts & category
                            </legend>
                            {importRelationshipFields.map((field) => {
                                const errorMsg = errors[`mapping.${field.key}`];
                                const inputId = `mapping-${field.key}`;
                                const hintId = `${inputId}-hint`;
                                const errorId = `${inputId}-error`;
                                const options =
                                    field.source === 'categories'
                                        ? categories
                                        : accounts;
                                const isSource =
                                    field.key === 'source_account_id';
                                const isDest =
                                    field.key === 'destination_account_id';

                                return (
                                    <div key={field.key}>
                                        <Label htmlFor={inputId}>
                                            {field.label}
                                        </Label>
                                        <p
                                            id={hintId}
                                            className="mt-0.5 text-xs text-muted-foreground"
                                        >
                                            {field.hint}
                                        </p>
                                        <select
                                            id={inputId}
                                            name={`mapping[${field.key}]`}
                                            defaultValue={
                                                !isSource && !isDest
                                                    ? (mappingConfig?.[
                                                          field.key
                                                      ] ?? '')
                                                    : undefined
                                            }
                                            value={
                                                isSource
                                                    ? sourceAccountId
                                                    : isDest
                                                      ? destinationAccountId
                                                      : undefined
                                            }
                                            onChange={
                                                isSource
                                                    ? (e) =>
                                                          setSourceAccountId(
                                                              e.target.value,
                                                          )
                                                    : isDest
                                                      ? (e) =>
                                                            setDestinationAccountId(
                                                                e.target.value,
                                                            )
                                                      : undefined
                                            }
                                            aria-invalid={Boolean(errorMsg)}
                                            aria-describedby={
                                                errorMsg
                                                    ? `${hintId} ${errorId}`
                                                    : hintId
                                            }
                                            className={selectClass}
                                        >
                                            <option value="">Not used</option>
                                            {options.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name}
                                                    {'type' in item &&
                                                    typeof item.type ===
                                                        'string' &&
                                                    item.type
                                                        ? ` (${item.type})`
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            id={errorId}
                                            message={errorMsg}
                                        />
                                    </div>
                                );
                            })}
                        </fieldset>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <Button
                                type="submit"
                                disabled={processing || headers.length === 0}
                            >
                                {processing && <Spinner />}
                                {processing
                                    ? 'Validating rows…'
                                    : 'Save mapping and preview rows'}
                            </Button>
                            {headers.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Source file headers are unavailable for this
                                    batch. Upload a new CSV or XLSX file to
                                    configure mapping.
                                </p>
                            )}
                        </div>
                    </div>
                );
            }}
        </Form>
    );
}
