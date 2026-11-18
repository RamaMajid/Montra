import { Form, Head, Link, usePoll } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatIdr } from '@/lib/format-currency';
import { getStatusBadge, type ImportBatchSummary } from './index';

type Row = {
    id: number;
    row_number: number;
    status: string;
    error_message: string | null;
    normalized_data: {
        description?: string;
        amount?: string | number | null;
        transaction_date?: string;
        type?: string;
    } | null;
};
type Props = {
    batch: ImportBatchSummary & {
        headers?: string[];
        mapping_config?: Record<string, string | number | null> | null;
    };
    headers?: string[];
    rows?: {
        data: Row[];
        current_page: number;
        last_page: number;
        prev_page_url: string | null;
        next_page_url: string | null;
    };
    accounts?: { id: number; name: string }[];
    categories?: { id: number; name: string; type?: string }[];
    canManage?: boolean;
};
const columns = [
    ['description', 'Description'],
    ['amount', 'Amount'],
    ['date', 'Transaction date'],
    ['type', 'Transaction type'],
    ['notes', 'Notes (optional)'],
] as const;
const relationships = [
    ['account_id', 'Income/expense account'],
    ['category_id', 'Income/expense category'],
    ['source_account_id', 'Transfer source account'],
    ['destination_account_id', 'Transfer destination account'],
] as const;
const selectClass =
    'mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

export default function ImportShow({
    batch,
    headers,
    rows,
    accounts = [],
    categories = [],
    canManage = false,
}: Props) {
    const [confirmed, setConfirmed] = useState(false);
    const processing = ['queued', 'processing'].includes(batch.status);
    const { start, stop } = usePoll(2500, {}, { autoStart: false });
    useEffect(() => {
        if (processing) start();
        else stop();
    }, [processing, start, stop]);
    const sourceHeaders = headers ?? batch.headers ?? [];
    const completed =
        batch.successful_rows + batch.failed_rows + batch.duplicate_rows;
    const finished = ['completed', 'completed_with_errors', 'failed'].includes(
        batch.status,
    );
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Imports', href: '/imports' },
                { title: `Batch #${batch.id}`, href: `/imports/${batch.id}` },
            ]}
        >
            <Head title={`Import batch #${batch.id}`} />
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
                <header>
                    <Link
                        href="/imports"
                        className="text-sm text-emerald-500 hover:underline"
                    >
                        Back to import history
                    </Link>
                    <h1 className="mt-3 text-2xl font-semibold break-words sm:text-3xl">
                        {batch.original_filename}
                    </h1>
                    <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Batch #{batch.id}</span>
                        {getStatusBadge(batch.status)}
                    </div>
                </header>
                <section className="rounded-xl border border-border bg-card p-5">
                    <h2 className="sr-only">Batch summary</h2>
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[
                            ['Total rows', batch.total_rows],
                            ['Imported', batch.successful_rows],
                            ['Failed / invalid', batch.failed_rows],
                            ['Duplicates skipped', batch.duplicate_rows],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-sm text-muted-foreground">
                                    {label}
                                </dt>
                                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <p role="status" className="mt-4 text-sm">
                        {processing
                            ? `${batch.status === 'queued' ? 'Queued. Waiting for worker.' : 'Processing.'} ${completed} of ${batch.total_rows} rows resolved.`
                            : finished
                              ? `${batch.status === 'completed' ? 'Import completed.' : batch.status === 'completed_with_errors' ? 'Import completed with errors. Review failed rows below.' : 'Import stopped. Review batch status and row errors.'}`
                              : 'No transactions created yet. Preview and confirmation required.'}
                    </p>
                    {processing && (
                        <progress
                            max={batch.total_rows || 1}
                            value={
                                batch.status === 'queued'
                                    ? undefined
                                    : completed
                            }
                            aria-label="Import processing progress"
                            className="mt-3 w-full accent-emerald-600"
                        />
                    )}
                </section>
                {canManage &&
                    ['uploaded', 'previewed'].includes(batch.status) && (
                        <Form
                            action={`/imports/${batch.id}/preview`}
                            method="put"
                            aria-labelledby="mapping-heading"
                            className="rounded-xl border border-border bg-card p-5"
                            onSuccess={() => setConfirmed(false)}
                        >
                            {({ errors, processing: previewing }) => (
                                <>
                                    <h2
                                        id="mapping-heading"
                                        className="text-lg font-medium"
                                    >
                                        Column mapping and formats
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Map file columns, then choose workspace
                                        accounts and category. Transfers require
                                        distinct source and destination
                                        accounts.
                                    </p>
                                    {Object.keys(errors).length > 0 && (
                                        <div
                                            role="alert"
                                            className="mt-4 text-sm text-destructive"
                                        >
                                            <ul>
                                                {Object.entries(errors).map(
                                                    ([key, message]) => (
                                                        <li key={key}>
                                                            {message}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                    <fieldset className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <legend className="sr-only">
                                            File columns
                                        </legend>
                                        {columns.map(([name, label]) => (
                                            <div key={name}>
                                                <Label
                                                    htmlFor={`mapping-${name}`}
                                                >
                                                    {label}
                                                    {name !== 'notes'
                                                        ? ' (required)'
                                                        : ''}
                                                </Label>
                                                <select
                                                    id={`mapping-${name}`}
                                                    name={`mapping[${name}]`}
                                                    required={name !== 'notes'}
                                                    defaultValue={
                                                        batch.mapping_config?.[
                                                            name
                                                        ] ?? ''
                                                    }
                                                    aria-invalid={Boolean(
                                                        errors[
                                                            `mapping.${name}`
                                                        ],
                                                    )}
                                                    aria-describedby={
                                                        errors[
                                                            `mapping.${name}`
                                                        ]
                                                            ? `mapping-${name}-error`
                                                            : undefined
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">
                                                        Not mapped
                                                    </option>
                                                    {sourceHeaders.map(
                                                        (header, index) => (
                                                            <option
                                                                key={`${header}-${index}`}
                                                                value={index}
                                                            >
                                                                {index + 1}.{' '}
                                                                {header ||
                                                                    'Unnamed column'}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <InputError
                                                    id={`mapping-${name}-error`}
                                                    message={
                                                        errors[
                                                            `mapping.${name}`
                                                        ]
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </fieldset>
                                    <fieldset className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                                        <legend className="sr-only">
                                            Data formats
                                        </legend>
                                        <div>
                                            <Label htmlFor="date-format">
                                                Date format
                                            </Label>
                                            <select
                                                id="date-format"
                                                name="mapping[date_format]"
                                                defaultValue={
                                                    batch.mapping_config
                                                        ?.date_format ?? 'Y-m-d'
                                                }
                                                aria-invalid={Boolean(
                                                    errors[
                                                        'mapping.date_format'
                                                    ],
                                                )}
                                                aria-describedby={
                                                    errors[
                                                        'mapping.date_format'
                                                    ]
                                                        ? 'date-format-error'
                                                        : undefined
                                                }
                                                className={selectClass}
                                            >
                                                <option value="Y-m-d">
                                                    YYYY-MM-DD (2026-11-18)
                                                </option>
                                                <option value="d/m/Y">
                                                    DD/MM/YYYY (18/11/2026)
                                                </option>
                                                <option value="m/d/Y">
                                                    MM/DD/YYYY (11/18/2026)
                                                </option>
                                            </select>
                                            <InputError
                                                id="date-format-error"
                                                message={
                                                    errors[
                                                        'mapping.date_format'
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="amount-format">
                                                IDR amount format
                                            </Label>
                                            <select
                                                id="amount-format"
                                                name="mapping[amount_format]"
                                                defaultValue={
                                                    batch.mapping_config
                                                        ?.amount_format ?? 'raw'
                                                }
                                                aria-invalid={Boolean(
                                                    errors[
                                                        'mapping.amount_format'
                                                    ],
                                                )}
                                                aria-describedby={
                                                    errors[
                                                        'mapping.amount_format'
                                                    ]
                                                        ? 'amount-format-error'
                                                        : undefined
                                                }
                                                className={selectClass}
                                            >
                                                <option value="raw">
                                                    Integer Rupiah (50000)
                                                </option>
                                                <option value="idr_dot">
                                                    Dot thousands (50.000)
                                                </option>
                                                <option value="idr_comma">
                                                    Comma thousands (50,000)
                                                </option>
                                            </select>
                                            <InputError
                                                id="amount-format-error"
                                                message={
                                                    errors[
                                                        'mapping.amount_format'
                                                    ]
                                                }
                                            />
                                        </div>
                                    </fieldset>
                                    <fieldset className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                                        <legend className="sr-only">
                                            Workspace references
                                        </legend>
                                        {relationships.map(([name, label]) => (
                                            <div key={name}>
                                                <Label
                                                    htmlFor={`mapping-${name}`}
                                                >
                                                    {label}
                                                </Label>
                                                <select
                                                    id={`mapping-${name}`}
                                                    name={`mapping[${name}]`}
                                                    defaultValue={
                                                        batch.mapping_config?.[
                                                            name
                                                        ] ?? ''
                                                    }
                                                    aria-invalid={Boolean(
                                                        errors[
                                                            `mapping.${name}`
                                                        ],
                                                    )}
                                                    aria-describedby={
                                                        errors[
                                                            `mapping.${name}`
                                                        ]
                                                            ? `mapping-${name}-error`
                                                            : undefined
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">
                                                        Not used
                                                    </option>
                                                    {(name === 'category_id'
                                                        ? categories
                                                        : accounts
                                                    ).map((item) => (
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
                                                    id={`mapping-${name}-error`}
                                                    message={
                                                        errors[
                                                            `mapping.${name}`
                                                        ]
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </fieldset>
                                    <Button
                                        disabled={
                                            previewing ||
                                            sourceHeaders.length === 0
                                        }
                                        className="mt-5 bg-emerald-700 text-white hover:bg-emerald-800"
                                    >
                                        {previewing
                                            ? 'Generating preview…'
                                            : 'Save mapping and preview'}
                                    </Button>
                                    {sourceHeaders.length === 0 && (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            File headers unavailable. Cannot
                                            configure mapping.
                                        </p>
                                    )}
                                </>
                            )}
                        </Form>
                    )}
                {rows && rows.data.length > 0 && (
                    <section className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="border-b border-border p-5">
                            <h2 className="text-lg font-medium">
                                Row preview and results
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Potential duplicates are skipped. Duplicate
                                override unavailable.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <caption className="sr-only">
                                    Normalized transaction rows and validation
                                    errors
                                </caption>
                                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                    <tr>
                                        {[
                                            'Row',
                                            'Status',
                                            'Type',
                                            'Description',
                                            'Amount',
                                            'Date',
                                            'Reason',
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                scope="col"
                                                className="p-4"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {rows.data.map((row) => {
                                        const amount =
                                            row.normalized_data?.amount;
                                        const amountText =
                                            amount === null ||
                                            amount === undefined
                                                ? ''
                                                : String(amount);
                                        return (
                                            <tr key={row.id}>
                                                <th
                                                    scope="row"
                                                    className="p-4 font-normal"
                                                >
                                                    {row.row_number}
                                                </th>
                                                <td className="p-4 font-medium">
                                                    {row.status}
                                                </td>
                                                <td className="p-4">
                                                    {row.normalized_data
                                                        ?.type ?? '—'}
                                                </td>
                                                <td className="p-4">
                                                    {row.normalized_data
                                                        ?.description ?? '—'}
                                                </td>
                                                <td className="p-4 whitespace-nowrap tabular-nums">
                                                    {/^[1-9][0-9]*$/.test(
                                                        amountText,
                                                    )
                                                        ? formatIdr(amountText)
                                                        : '—'}
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    {row.normalized_data
                                                        ?.transaction_date ??
                                                        '—'}
                                                </td>
                                                <td className="p-4 text-muted-foreground">
                                                    {row.error_message ??
                                                        (row.status ===
                                                            'duplicate' ||
                                                        row.status === 'skipped'
                                                            ? 'Potential duplicate. Skipped.'
                                                            : row.status ===
                                                                'imported'
                                                              ? 'Imported successfully.'
                                                              : row.status ===
                                                                  'valid'
                                                                ? 'Ready to import.'
                                                                : 'Review row data.')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {rows.last_page > 1 && (
                            <nav
                                aria-label="Import row pages"
                                className="flex items-center justify-between border-t border-border p-4"
                            >
                                {rows.prev_page_url ? (
                                    <Link
                                        href={rows.prev_page_url}
                                        className="text-sm text-emerald-500 hover:underline"
                                    >
                                        Previous
                                    </Link>
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        Previous
                                    </span>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    Page {rows.current_page} of {rows.last_page}
                                </span>
                                {rows.next_page_url ? (
                                    <Link
                                        href={rows.next_page_url}
                                        className="text-sm text-emerald-500 hover:underline"
                                    >
                                        Next
                                    </Link>
                                ) : (
                                    <span className="text-sm text-muted-foreground">
                                        Next
                                    </span>
                                )}
                            </nav>
                        )}
                    </section>
                )}
                {canManage && batch.status === 'previewed' && (
                    <Form
                        action={`/imports/${batch.id}/confirm`}
                        method="post"
                        aria-labelledby="confirm-heading"
                        className="rounded-xl border border-emerald-700/40 bg-card p-5"
                    >
                        {({ processing: confirming, errors }) => (
                            <>
                                <h2
                                    id="confirm-heading"
                                    className="text-lg font-medium"
                                >
                                    Confirm import
                                </h2>
                                <p
                                    id="confirm-help"
                                    className="mt-1 text-sm text-muted-foreground"
                                >
                                    Only valid rows create transactions. Invalid
                                    and duplicate rows stay in batch report.
                                </p>
                                <div className="mt-4 flex items-start gap-3">
                                    <input
                                        id="confirm"
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
                                                ? 'confirm-help confirm-error'
                                                : 'confirm-help'
                                        }
                                        className="mt-1 h-5 w-5 accent-emerald-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    />
                                    <Label htmlFor="confirm">
                                        I reviewed mapping and all row results.
                                        Import valid rows into workspace ledger.
                                    </Label>
                                </div>
                                <InputError
                                    id="confirm-error"
                                    message={errors.confirmed}
                                />
                                {Object.entries(errors)
                                    .filter(([key]) => key !== 'confirmed')
                                    .map(([key, message]) => (
                                        <p
                                            key={key}
                                            role="alert"
                                            className="mt-2 text-sm text-destructive"
                                        >
                                            {message}
                                        </p>
                                    ))}
                                <Button
                                    disabled={confirming}
                                    className="mt-5 bg-emerald-700 text-white hover:bg-emerald-800"
                                >
                                    {confirming
                                        ? 'Queuing…'
                                        : 'Confirm and queue import'}
                                </Button>
                            </>
                        )}
                    </Form>
                )}
            </main>
        </AppLayout>
    );
}
