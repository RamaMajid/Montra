import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import {
    ImportBatchSummaryCard,
    ImportConfirmForm,
} from '@/components/imports/import-batch-summary';
import {
    buildImportBatchQuery,
    ImportHistoryList,
    ImportHistorySkeleton,
} from '@/components/imports/import-history-list';
import {
    importAmountFormatOptions,
    importDateFormatOptions,
    ImportMappingForm,
} from '@/components/imports/import-mapping-form';
import { ImportPreviewTable } from '@/components/imports/import-preview-table';
import {
    getActiveWorkflowStep,
    ImportRowStatusBadge,
    ImportStatusBadge,
    ImportWorkflowSteps,
} from '@/components/imports/import-status-badge';
import {
    ImportUploadForm,
    validateImportFile,
} from '@/components/imports/import-upload-form';
import type {
    ImportAccountOption,
    ImportBatchSummary,
    ImportCategoryOption,
    ImportRowItem,
    PaginatedImportBatches,
    PaginatedImportRows,
} from '@/components/imports/types';
import { ImportsUploadSection } from '@/pages/imports/index';
import importsRoutes from '@/routes/imports';

const accounts: ImportAccountOption[] = [
    { id: 1, name: 'Primary Bank' },
    { id: 2, name: 'Savings Vault' },
];

const categories: ImportCategoryOption[] = [
    { id: 10, name: 'Salary', type: 'income' },
    { id: 11, name: 'Groceries', type: 'expense' },
];

const sampleBatches: PaginatedImportBatches = {
    data: [
        {
            id: 41,
            original_filename: 'march_statement.csv',
            file_type: 'csv',
            status: 'completed',
            total_rows: 20,
            successful_rows: 18,
            failed_rows: 0,
            duplicate_rows: 2,
            confirmed_at: '2026-03-31T10:15:00Z',
        },
        {
            id: 42,
            original_filename: 'april_wallet.xlsx',
            file_type: 'xlsx',
            status: 'completed_with_errors',
            total_rows: 10,
            successful_rows: 7,
            failed_rows: 2,
            duplicate_rows: 1,
            confirmed_at: '2026-04-02T09:00:00Z',
        },
        {
            id: 43,
            original_filename: 'pending_review.csv',
            file_type: 'csv',
            status: 'previewed',
            total_rows: 5,
            successful_rows: 0,
            failed_rows: 1,
            duplicate_rows: 1,
            confirmed_at: null,
        },
    ],
    current_page: 1,
    last_page: 2,
    total: 3,
    prev_page_url: null,
    next_page_url: '/imports?page=2',
};

const sampleRows: PaginatedImportRows = {
    data: [
        {
            id: 501,
            row_number: 2,
            status: 'valid',
            error_message: null,
            normalized_data: {
                type: 'income',
                description: 'Executive Payroll',
                amount: '9007199254740993',
                transaction_date: '2026-03-25',
                account_id: 1,
                category_id: 10,
                notes: 'March bonus',
            },
        },
        {
            id: 502,
            row_number: 3,
            status: 'duplicate',
            error_message:
                'Potential duplicate of an existing transaction or row within this import batch.',
            normalized_data: {
                type: 'expense',
                description: 'Supermarket purchase',
                amount: '350000',
                transaction_date: '2026-03-26',
                account_id: 1,
                category_id: 11,
                notes: null,
            },
        },
        {
            id: 503,
            row_number: 4,
            status: 'invalid',
            error_message:
                'Source and destination accounts must be different for transfers.',
            normalized_data: {
                type: 'transfer',
                description: 'Internal sweep',
                amount: 'INVALID_AMOUNT',
                transaction_date: null,
                source_account_id: 1,
                destination_account_id: 2,
                notes: null,
            },
        },
    ],
    current_page: 1,
    last_page: 2,
    prev_page_url: null,
    next_page_url: '/imports/43?page=2',
};

describe('Transaction Imports Phase 4', () => {
    it('validates upload files for CSV/XLSX extension, non-empty size, and 10 MB limit, and gates upload UI by permission', () => {
        expect(validateImportFile(null)).toBe(
            'Select a CSV or XLSX file to upload.',
        );
        expect(validateImportFile({ name: 'legacy.xls', size: 2048 })).toBe(
            'Only CSV (.csv) and Excel (.xlsx) files are supported.',
        );
        expect(validateImportFile({ name: 'empty.csv', size: 0 })).toBe(
            'Selected file is empty.',
        );
        expect(
            validateImportFile({
                name: 'huge.xlsx',
                size: 10240 * 1024 + 1,
            }),
        ).toBe('File exceeds the 10 MB (10,240 KB) maximum size.');
        expect(
            validateImportFile({
                name: 'valid_statement.CSV',
                size: 10240 * 1024,
            }),
        ).toBeNull();

        const uploadFormHtml = renderToStaticMarkup(
            createElement(ImportUploadForm, {
                initialFileName: 'statement.csv',
                initialFileSize: 4096,
            }),
        );
        expect(uploadFormHtml).toContain(
            `action="${importsRoutes.store.form().action}"`,
        );
        expect(uploadFormHtml).toContain('accept=".csv,.xlsx"');
        expect(uploadFormHtml).toContain('statement.csv');
        expect(uploadFormHtml).toContain('Remove file');

        const viewerUploadHtml = renderToStaticMarkup(
            createElement(ImportsUploadSection, {
                canUpload: false,
            }),
        );
        expect(viewerUploadHtml).toContain(
            'view-only access in this workspace',
        );
        expect(viewerUploadHtml).not.toContain('id="import-file-input"');
    });

    it('renders batch history list, status filter, empty state, and loading skeleton', () => {
        const listHtml = renderToStaticMarkup(
            createElement(ImportHistoryList, {
                batches: sampleBatches,
                statusFilter: 'completed',
            }),
        );
        expect(listHtml).toContain('<search>');
        expect(listHtml).toContain('march_statement.csv');
        expect(listHtml).toContain('april_wallet.xlsx');
        expect(listHtml).toContain('Completed with errors');
        expect(listHtml).toContain(`href="${importsRoutes.show.url(41)}"`);
        expect(listHtml).toContain('Page 1 of 2 (3 total)');

        expect(buildImportBatchQuery('completed_with_errors')).toEqual({
            status: 'completed_with_errors',
        });
        expect(buildImportBatchQuery('unknown_status')).toEqual({});

        const emptyHtml = renderToStaticMarkup(
            createElement(ImportHistoryList, {
                batches: {
                    ...sampleBatches,
                    data: [],
                    last_page: 1,
                    total: 0,
                },
                statusFilter: 'failed',
            }),
        );
        expect(emptyHtml).toContain('No import batches found');
        expect(emptyHtml).toContain(
            'No import batches match the selected status filter.',
        );
        expect(
            renderToStaticMarkup(createElement(ImportHistorySkeleton)),
        ).toContain('Loading import batches');
    });

    it('renders column mapping form with all backend date_format and amount_format options, plus duplicate-column and same-transfer-account warnings', () => {
        expect(importDateFormatOptions.map((o) => o.value)).toEqual([
            'Y-m-d',
            'd/m/Y',
            'm/d/Y',
            'd-m-Y',
        ]);
        expect(importAmountFormatOptions.map((o) => o.value)).toEqual([
            'raw',
            'idr_dot',
            'idr_comma',
        ]);

        const mappingHtml = renderToStaticMarkup(
            createElement(ImportMappingForm, {
                batchId: 43,
                headers: ['Date', 'Type', 'Description', 'Amount', 'Notes'],
                mappingConfig: {
                    description: 2,
                    amount: 2,
                    date: 0,
                    type: 1,
                    date_format: 'd-m-Y',
                    amount_format: 'idr_dot',
                    account_id: 1,
                    category_id: 11,
                    source_account_id: 1,
                    destination_account_id: 1,
                },
                accounts,
                categories,
            }),
        );

        expect(mappingHtml).toContain(
            `action="${importsRoutes.preview.form(43).action}"`,
        );
        expect(mappingHtml).toContain('value="d-m-Y"');
        expect(mappingHtml).toContain('DD-MM-YYYY (18-11-2026)');
        expect(mappingHtml).toContain(
            'Multiple transaction fields are mapped to the same file column.',
        );
        expect(mappingHtml).toContain(
            'Transfer source and destination accounts must be different',
        );
        expect(mappingHtml).toContain('Primary Bank');
        expect(mappingHtml).toContain('Groceries (expense)');
    });

    it('renders row preview table with BigInt IDR precision, transfer account resolution, and valid/duplicate/invalid status explanations', () => {
        const previewHtml = renderToStaticMarkup(
            createElement(ImportPreviewTable, {
                rows: sampleRows,
                accounts,
                categories,
            }),
        );

        expect(previewHtml).toContain('+Rp9.007.199.254.740.993');
        expect(previewHtml).toContain('-Rp350.000');
        expect(previewHtml).toContain('Invalid amount');
        expect(previewHtml).toContain('Primary Bank → Savings Vault');
        expect(previewHtml).toContain('Salary');
        expect(previewHtml).toContain(
            'Potential duplicate of an existing transaction or row within this import batch.',
        );
        expect(previewHtml).toContain(
            'Source and destination accounts must be different for transfers.',
        );
        expect(previewHtml).toContain('Eligible on page:');
        expect(previewHtml).toContain('Duplicates on page:');
        expect(previewHtml).toContain('Invalid / failed on page:');

        const emptyPreviewHtml = renderToStaticMarkup(
            createElement(ImportPreviewTable, {
                rows: { ...sampleRows, data: [], last_page: 1 },
                accounts,
                categories,
            }),
        );
        expect(emptyPreviewHtml).toContain('No preview rows generated yet');
    });

    it('renders workflow steps, processing progress bar, terminal result links, and explicit confirmation form', () => {
        expect(getActiveWorkflowStep('uploaded')).toBe('map');
        expect(getActiveWorkflowStep('previewed')).toBe('confirm');
        expect(getActiveWorkflowStep('processing')).toBe('confirm');
        expect(getActiveWorkflowStep('completed_with_errors')).toBe('result');

        const stepsHtml = renderToStaticMarkup(
            createElement(ImportWorkflowSteps, { status: 'previewed' }),
        );
        expect(stepsHtml).toContain('aria-current="step"');

        const processingBatch: ImportBatchSummary = {
            id: 44,
            original_filename: 'bulk.csv',
            file_type: 'csv',
            status: 'processing',
            total_rows: 100,
            successful_rows: 40,
            failed_rows: 5,
            duplicate_rows: 5,
        };
        const processingSummaryHtml = renderToStaticMarkup(
            createElement(ImportBatchSummaryCard, { batch: processingBatch }),
        );
        expect(processingSummaryHtml).toContain('<progress');
        expect(processingSummaryHtml).toContain('value="50"');
        expect(processingSummaryHtml).toContain('max="100"');
        expect(processingSummaryHtml).toContain('50 of 100 rows resolved.');

        const completedSummaryHtml = renderToStaticMarkup(
            createElement(ImportBatchSummaryCard, {
                batch: sampleBatches.data[0],
            }),
        );
        expect(completedSummaryHtml).toContain('View workspace transactions');
        expect(completedSummaryHtml).toContain('Upload another file');

        const confirmHtml = renderToStaticMarkup(
            createElement(ImportConfirmForm, {
                batchId: 43,
                defaultConfirmed: false,
            }),
        );
        expect(confirmHtml).toContain(
            `action="${importsRoutes.confirm.form(43).action}"`,
        );
        expect(confirmHtml).toContain('name="confirmed"');
        expect(confirmHtml).toContain('Confirm and queue import');

        // Verify all row & batch status badges render without error
        for (const status of [
            'uploaded',
            'previewed',
            'queued',
            'processing',
            'completed',
            'completed_with_errors',
            'failed',
        ]) {
            expect(
                renderToStaticMarkup(
                    createElement(ImportStatusBadge, { status }),
                ),
            ).toBeTruthy();
        }
        for (const rowStatus of [
            'valid',
            'invalid',
            'duplicate',
            'imported',
            'failed',
            'skipped',
        ] satisfies ImportRowItem['status'][]) {
            expect(
                renderToStaticMarkup(
                    createElement(ImportRowStatusBadge, { status: rowStatus }),
                ),
            ).toBeTruthy();
        }
    });
});
