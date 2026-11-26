import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { ArchiveBudgetForm } from '@/components/budgets/archive-budget-dialog';
import {
    BudgetForm,
    allocationsExceedTotal,
    periodDates,
} from '@/components/budgets/budget-form';
import {
    BudgetAllocationList,
    BudgetHistory,
    BudgetSummary,
    BudgetsSkeleton,
} from '@/components/budgets/budget-list';
import {
    BudgetProgressBar,
    BudgetWarningBadge,
} from '@/components/budgets/budget-status';
import type { BudgetItem } from '@/components/budgets/types';
import budgetsRoutes from '@/routes/budgets';

const budget: BudgetItem = {
    id: 7,
    name: 'November household plan',
    period_start: '2026-11-01',
    period_end: '2026-11-30',
    total_amount: '9007199254740993',
    status: 'active',
    created_by: 1,
    creator_name: 'Rifki',
    can_archive: true,
    progress: {
        actual_amount: '6305039478318696',
        remaining_amount: '2702159776422297',
        utilization: '70',
        warning: 'warning',
        allocations: [
            {
                category_id: 10,
                category_name: 'Groceries',
                category_active: true,
                allocated_amount: '1000000',
                actual_amount: '950000',
                remaining_amount: '50000',
                utilization: '95',
                warning: 'critical',
            },
            {
                category_id: 11,
                category_name: 'Transport',
                category_active: false,
                allocated_amount: '500000',
                actual_amount: '650000',
                remaining_amount: '-150000',
                utilization: '130',
                warning: 'exceeded',
            },
        ],
    },
};

describe('Budgets Phase 5', () => {
    it('renders server-authoritative summary, period, warning, utilization, and BigInt-safe money', () => {
        const html = renderToStaticMarkup(
            createElement(BudgetSummary, { budget }),
        );
        expect(html).toContain('November household plan');
        expect(html).toContain('1 Nov 2026');
        expect(html).toContain('30 Nov 2026');
        expect(html).toContain('Rp9.007.199.254.740.993');
        expect(html).toContain('Rp6.305.039.478.318.696');
        expect(html).toContain('Rp2.702.159.776.422.297 left');
        expect(html).toContain('Approaching limit');
        expect(html).toContain('aria-valuenow="70"');
    });

    it('renders category progress, archived category history, warning, exceeded, and negative remaining states', () => {
        const html = renderToStaticMarkup(
            createElement(BudgetAllocationList, { budget }),
        );
        expect(html).toContain('Groceries');
        expect(html).toContain('Transport');
        expect(html).toContain('Archived category · historical allocation');
        expect(html).toContain('Critical');
        expect(html).toContain('Exceeded');
        expect(html).toContain('Rp150.000 over');
        expect(html).toContain('aria-valuenow="100"');

        const empty = renderToStaticMarkup(
            createElement(BudgetAllocationList, {
                budget: {
                    ...budget,
                    progress: { ...budget.progress, allocations: [] },
                },
            }),
        );
        expect(empty).toContain('No category allocations');
    });

    it('renders active and archived history with desktop table, mobile cards, and role-aware actions', () => {
        const archived: BudgetItem = {
            ...budget,
            id: 6,
            name: 'October plan',
            status: 'archived',
            can_archive: false,
            period_start: '2026-10-01',
            period_end: '2026-10-31',
        };
        const html = renderToStaticMarkup(
            createElement(BudgetHistory, {
                budgets: [budget, archived],
                canManage: true,
                selectedBudgetId: budget.id,
                onSelect: () => undefined,
                onEdit: () => undefined,
                onArchive: () => undefined,
            }),
        );
        expect(html).toContain('Monthly budgets with periods');
        expect(html).toContain('md:hidden');
        expect(html).toContain('October plan');
        expect(html).toContain('Archived');
        expect(html).toContain('Archive');
        expect(html).not.toContain('disabled=""');
        expect(html).toContain('aria-pressed="true"');
        const viewer = renderToStaticMarkup(
            createElement(BudgetHistory, {
                budgets: [{ ...budget, can_archive: false }],
                canManage: false,
                onSelect: () => undefined,
                onEdit: () => undefined,
                onArchive: () => undefined,
            }),
        );
        expect(viewer).not.toContain('Edit');
        expect(viewer).not.toContain('Archive');
        expect(viewer).toContain('View');

        const empty = renderToStaticMarkup(
            createElement(BudgetHistory, {
                budgets: [],
                onEdit: () => undefined,
                onArchive: () => undefined,
            }),
        );
        expect(empty).toContain('No budgets yet');
        expect(renderToStaticMarkup(createElement(BudgetsSkeleton))).toContain(
            'Loading budgets',
        );
    });

    it('renders create/edit contract fields, full calendar month dates, active expense options, and precision-safe allocation total', () => {
        expect(periodDates('2024-02')).toEqual({
            start: '2024-02-01',
            end: '2024-02-29',
        });
        expect(periodDates('invalid')).toEqual({ start: '', end: '' });
        expect(allocationsExceedTotal(1500001n, '1500000')).toBe(true);
        expect(allocationsExceedTotal(1500000n, '1500000')).toBe(false);

        const overAllocatedHtml = renderToStaticMarkup(
            createElement(BudgetForm, {
                budget: { ...budget, total_amount: '1000000' },
                categories: [
                    { id: 10, name: 'Groceries' },
                    { id: 11, name: 'Transport (Archived)', is_active: false },
                ],
                onCancel: () => undefined,
            }),
        );
        expect(overAllocatedHtml).toContain(
            'Category allocations cannot exceed the total budget.',
        );

        const createHtml = renderToStaticMarkup(
            createElement(BudgetForm, {
                budget: null,
                categories: [
                    { id: 10, name: 'Groceries' },
                    { id: 11, name: 'Transport' },
                ],
                onCancel: () => undefined,
            }),
        );
        expect(createHtml).toContain(
            `action="${budgetsRoutes.store.form().action}"`,
        );
        expect(createHtml).toContain('name="period_start"');
        expect(createHtml).toContain('name="period_end"');
        expect(createHtml).toContain('name="total_amount"');
        expect(createHtml).toContain('pattern="[1-9][0-9]*"');
        expect(createHtml).toContain('Only active expense categories');

        const editHtml = renderToStaticMarkup(
            createElement(BudgetForm, {
                budget,
                categories: [
                    { id: 10, name: 'Groceries' },
                    { id: 11, name: 'Transport (Archived)', is_active: false },
                ],
                onCancel: () => undefined,
            }),
        );
        expect(editHtml).toContain(
            `action="${budgetsRoutes.update.form(7).action.replace('&', '&amp;')}"`,
        );
        expect(editHtml).toContain('value="9007199254740993"');
        expect(editHtml).toContain('Allocated:');
        expect(editHtml).toContain('Rp1.500.000');
    });

    it('renders accessible utilization and archive confirmation form using backend Wayfinder route', () => {
        const progress = renderToStaticMarkup(
            createElement(BudgetProgressBar, {
                label: 'Food budget',
                utilization: '130',
                warning: 'exceeded',
            }),
        );
        expect(progress).toContain('role="progressbar"');
        expect(progress).toContain('aria-valuemax="100"');
        expect(progress).toContain('aria-valuenow="100"');
        expect(progress).toContain('130%, Exceeded');
        expect(
            renderToStaticMarkup(
                createElement(BudgetWarningBadge, {
                    warning: 'on_track',
                    utilization: '0',
                }),
            ),
        ).toContain('On track');

        const archiveHtml = renderToStaticMarkup(
            createElement(ArchiveBudgetForm, {
                budget,
                onCancel: () => undefined,
                onSuccess: () => undefined,
            }),
        );
        expect(archiveHtml).toContain(
            `action="${budgetsRoutes.archive.form(7).action}"`,
        );
        expect(archiveHtml).toContain('Keep budget');
        expect(archiveHtml).toContain('Archive budget');
    });
});
