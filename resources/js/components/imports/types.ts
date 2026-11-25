export type ImportBatchStatus =
    | 'uploaded'
    | 'previewed'
    | 'queued'
    | 'processing'
    | 'completed'
    | 'completed_with_errors'
    | 'failed';

export type ImportDateFormat = 'Y-m-d' | 'd/m/Y' | 'm/d/Y' | 'd-m-Y';
export type ImportAmountFormat = 'raw' | 'idr_dot' | 'idr_comma';

export type ImportMappingConfig = {
    type?: number | string | null;
    description?: number | string | null;
    amount?: number | string | null;
    date?: number | string | null;
    notes?: number | string | null;
    date_format?: ImportDateFormat | null;
    amount_format?: ImportAmountFormat | null;
    account_id?: number | string | null;
    category_id?: number | string | null;
    source_account_id?: number | string | null;
    destination_account_id?: number | string | null;
};

export type ImportBatchSummary = {
    id: number;
    original_filename: string;
    file_type: string;
    status: ImportBatchStatus;
    total_rows: number;
    successful_rows: number;
    failed_rows: number;
    duplicate_rows: number;
    confirmed_at?: string | null;
};

export type PaginatedImportBatches = {
    data: ImportBatchSummary[];
    current_page: number;
    last_page: number;
    per_page?: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links?: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
};

export type ImportRowStatus =
    | 'valid'
    | 'invalid'
    | 'duplicate'
    | 'imported'
    | 'failed'
    | 'skipped';

export type ImportNormalizedData = {
    type?: string | null;
    description?: string | null;
    amount?: string | number | null;
    transaction_date?: string | null;
    account_id?: number | string | null;
    category_id?: number | string | null;
    source_account_id?: number | string | null;
    destination_account_id?: number | string | null;
    notes?: string | null;
};

export type ImportRowItem = {
    id: number;
    row_number: number;
    status: ImportRowStatus;
    error_message: string | null;
    raw_data?: string[] | null;
    normalized_data: ImportNormalizedData | null;
    transaction_id?: number | null;
};

export type PaginatedImportRows = {
    data: ImportRowItem[];
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export type ImportAccountOption = {
    id: number;
    name: string;
};

export type ImportCategoryOption = {
    id: number;
    name: string;
    type?: string;
};

export const importBatchStatusOptions: Array<{
    value: ImportBatchStatus;
    label: string;
}> = [
    { value: 'uploaded', label: 'Uploaded' },
    { value: 'previewed', label: 'Previewed' },
    { value: 'queued', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'completed_with_errors', label: 'Completed with errors' },
    { value: 'failed', label: 'Failed' },
];
