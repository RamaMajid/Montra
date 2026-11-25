import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import {
    buildTransactionQuery,
    sortOptions,
    TransactionFilters,
} from '@/components/transactions/transaction-filters';
import { TransactionForm } from '@/components/transactions/transaction-form';
import {
    DeleteTransactionDialog,
    DeleteTransactionForm,
    TransactionDetailBody,
    TransactionList,
    TransactionsSkeleton,
} from '@/components/transactions/transaction-list';
import type {
    PaginatedTransactions,
    TransactionAccount,
    TransactionCategory,
    TransactionItem,
} from '@/components/transactions/types';
import transactionsRoutes from '@/routes/transactions';

const accounts: TransactionAccount[] = [
    {
        id: 1,
        name: 'Primary Bank',
        type: 'bank',
        color: '#34785A',
        icon: 'landmark',
        is_active: true,
    },
    {
        id: 2,
        name: 'Savings Vault',
        type: 'savings',
        color: '#A7D8B5',
        icon: 'piggy-bank',
        is_active: true,
    },
    {
        id: 3,
        name: 'Legacy Wallet',
        type: 'e_wallet',
        color: null,
        icon: null,
        is_active: false,
    },
];

const categories: TransactionCategory[] = [
    {
        id: 10,
        name: 'Salary',
        type: 'income',
        color: '#34785A',
        icon: 'briefcase',
        is_active: true,
    },
    {
        id: 11,
        name: 'Groceries',
        type: 'expense',
        color: '#E07A5F',
        icon: 'shopping-cart',
        is_active: true,
    },
    {
        id: 12,
        name: 'Old Bonus',
        type: 'income',
        color: null,
        icon: null,
        is_active: false,
    },
];

const incomeTx: TransactionItem = {
    id: 101,
    type: 'income',
    description: 'Monthly salary',
    amount: '9007199254740993',
    transaction_date: '2026-03-25',
    notes: 'Payroll March',
    source: 'manual',
    created_by: 1,
    creator_name: 'Rifki',
    account: accounts[0],
    source_account: null,
    destination_account: null,
    category: categories[0],
    can_edit: true,
    can_delete: true,
};

const expenseTx: TransactionItem = {
    id: 102,
    type: 'expense',
    description: 'Weekly groceries',
    amount: '450000',
    transaction_date: '2026-03-26',
    notes: null,
    source: 'manual',
    created_by: 2,
    creator_name: 'Family Member',
    account: accounts[0],
    source_account: null,
    destination_account: null,
    category: categories[1],
    can_edit: true,
    can_delete: false,
};

const transferTx: TransactionItem = {
    id: 103,
    type: 'transfer',
    description: 'Move to savings',
    amount: '2500000',
    transaction_date: '2026-03-27',
    notes: 'Emergency fund allocation',
    source: 'manual',
    created_by: 1,
    creator_name: 'Rifki',
    account: null,
    source_account: accounts[0],
    destination_account: accounts[1],
    category: null,
    can_edit: false,
    can_delete: false,
};

const paginated: PaginatedTransactions = {
    data: [incomeTx, expenseTx, transferTx],
    current_page: 2,
    last_page: 3,
    per_page: 15,
    total: 33,
    prev_page_url: '/transactions?type=transfer&page=1',
    next_page_url: '/transactions?type=transfer&page=3',
    links: [],
};

describe('Transactions Phase 3', () => {
    it('renders income, expense, and transfer rows with BigInt precision, distinct semantics, and row-level permissions', () => {
        const html = renderToStaticMarkup(
            createElement(TransactionList, {
                transactions: paginated,
                canCreate: true,
                onCreate: () => undefined,
                onEdit: () => undefined,
                onDetail: () => undefined,
            }),
        );

        expect(html).toContain('+Rp9.007.199.254.740.993');
        expect(html).toContain('-Rp450.000');
        expect(html).toContain('Rp2.500.000');
        expect(html).not.toContain('+Rp2.500.000');
        expect(html).not.toContain('-Rp2.500.000');
        expect(html).toContain('Primary Bank → Savings Vault');
        expect(html).toContain('Income: ');
        expect(html).toContain('Expense: ');
        expect(html).toContain('Transfer: ');
        expect(html).toContain('16–30 of 33');
        expect(html).toContain('Page 2 of 3');
        expect(html).toContain('href="/transactions?type=transfer&amp;page=1"');
        expect(html).toContain('href="/transactions?type=transfer&amp;page=3"');

        // incomeTx has can_edit + can_delete; expenseTx has can_edit only; transferTx has neither
        expect(html).toContain(
            'Edit<span class="sr-only"> Monthly salary</span>',
        );
        expect(html).toContain(
            'Delete<span class="sr-only"> Monthly salary</span>',
        );
        expect(html).toContain(
            'Edit<span class="sr-only"> Weekly groceries</span>',
        );
        expect(html).not.toContain(
            'Delete<span class="sr-only"> Weekly groceries</span>',
        );
        expect(html).not.toContain(
            'Edit<span class="sr-only"> Move to savings</span>',
        );
        expect(html).not.toContain(
            'Delete<span class="sr-only"> Move to savings</span>',
        );
    });

    it('renders empty state according to canCreate and loading skeleton', () => {
        const emptyCanCreate = renderToStaticMarkup(
            createElement(TransactionList, {
                transactions: {
                    ...paginated,
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    total: 0,
                    prev_page_url: null,
                    next_page_url: null,
                },
                canCreate: true,
                onCreate: () => undefined,
                onEdit: () => undefined,
                onDetail: () => undefined,
            }),
        );
        const emptyViewer = renderToStaticMarkup(
            createElement(TransactionList, {
                transactions: {
                    ...paginated,
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    total: 0,
                    prev_page_url: null,
                    next_page_url: null,
                },
                canCreate: false,
                onCreate: () => undefined,
                onEdit: () => undefined,
                onDetail: () => undefined,
            }),
        );

        expect(emptyCanCreate).toContain('No transactions found');
        expect(emptyCanCreate).toContain('Add transaction');
        expect(emptyViewer).toContain('No transactions found');
        expect(emptyViewer).not.toContain('Add transaction');
        expect(
            renderToStaticMarkup(createElement(TransactionsSkeleton)),
        ).toContain('Loading transactions');
    });

    it('renders detail dialog and delete confirmation dialog with Wayfinder destroy route', () => {
        const transferDetail = renderToStaticMarkup(
            createElement(TransactionDetailBody, {
                transaction: transferTx,
                onClose: () => undefined,
                onEdit: () => undefined,
            }),
        );
        const incomeDetail = renderToStaticMarkup(
            createElement(TransactionDetailBody, {
                transaction: incomeTx,
                onClose: () => undefined,
                onEdit: () => undefined,
            }),
        );
        const deleteTrigger = renderToStaticMarkup(
            createElement(DeleteTransactionDialog, {
                transaction: incomeTx,
            }),
        );
        const deleteForm = renderToStaticMarkup(
            createElement(DeleteTransactionForm, {
                transaction: incomeTx,
            }),
        );

        expect(transferDetail).toContain('Primary Bank → Savings Vault');
        expect(transferDetail).toContain('Emergency fund allocation');
        expect(transferDetail).not.toContain('Edit transaction');
        expect(incomeDetail).toContain('Payroll March');
        expect(incomeDetail).toContain('Edit transaction');
        expect(deleteTrigger).toContain('aria-haspopup="dialog"');
        expect(deleteTrigger).toContain('Monthly salary');
        expect(deleteForm).toContain(
            `action="${transactionsRoutes.destroy.form(incomeTx.id).action}"`,
        );
        expect(deleteForm).toContain('Delete transaction');
    });

    it('enforces form fields by type and preserves archived references only for the original field being edited', () => {
        const createExpense = renderToStaticMarkup(
            createElement(TransactionForm, {
                transaction: null,
                accounts,
                categories,
                initialType: 'expense',
                onCancel: () => undefined,
            }),
        );
        const createTransfer = renderToStaticMarkup(
            createElement(TransactionForm, {
                transaction: null,
                accounts,
                categories,
                initialType: 'transfer',
                onCancel: () => undefined,
            }),
        );
        const editArchivedIncome = renderToStaticMarkup(
            createElement(TransactionForm, {
                transaction: {
                    ...incomeTx,
                    account: accounts[2],
                    category: categories[2],
                },
                accounts,
                categories,
                onCancel: () => undefined,
            }),
        );

        expect(createExpense).toContain('name="account_id"');
        expect(createExpense).toContain('name="category_id"');
        expect(createExpense).not.toContain('name="source_account_id"');
        expect(createExpense).not.toContain('name="destination_account_id"');
        expect(createExpense).toContain('Groceries');
        expect(createExpense).not.toContain('Salary');
        expect(createExpense).not.toContain('Legacy Wallet');
        expect(createExpense).not.toContain('Old Bonus');

        expect(createTransfer).toContain('name="source_account_id"');
        expect(createTransfer).toContain('name="destination_account_id"');
        expect(createTransfer).not.toContain('name="account_id"');
        expect(createTransfer).not.toContain('name="category_id"');

        expect(editArchivedIncome).toContain('Legacy Wallet (Archived)');
        expect(editArchivedIncome).toContain('Old Bonus (Archived)');
        expect(editArchivedIncome).toContain(
            'Formatted: Rp9.007.199.254.740.993',
        );
    });

    it('renders backend filter controls, disables category filter for transfer, and validates date ranges', () => {
        const filterHtml = renderToStaticMarkup(
            createElement(TransactionFilters, {
                filters: {
                    type: 'transfer',
                    account_id: '1',
                    category_id: '',
                    date_from: '2026-04-10',
                    date_to: '2026-04-01',
                    search: 'rent',
                    sort: 'amount_desc',
                },
                accounts,
                categories,
            }),
        );

        expect(sortOptions.map((item) => item.value)).toEqual([
            'date_desc',
            'date_asc',
            'amount_desc',
            'amount_asc',
        ]);
        expect(filterHtml).toContain('<search');
        expect(filterHtml).toContain('Start date cannot be after end date.');
        expect(filterHtml).toContain('Clear filters');
        expect(
            buildTransactionQuery({
                type: 'expense',
                account_id: '',
                category_id: '11',
                date_from: '2026-03-01',
                date_to: '',
                search: '  coffee ',
                sort: 'date_desc',
            }),
        ).toEqual({
            type: 'expense',
            category_id: '11',
            date_from: '2026-03-01',
            search: 'coffee',
        });
        expect(
            buildTransactionQuery({
                sort: 'amount_asc',
            }),
        ).toEqual({
            sort: 'amount_asc',
        });
    });
});
