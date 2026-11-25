import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import AlertError from '@/components/alert-error';
import { AccountDistribution } from '@/components/dashboard/account-distribution';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import {
    buildQuery,
    periodOptions,
} from '@/components/dashboard/dashboard-period-filter';
import { ExpenseBreakdown } from '@/components/dashboard/expense-breakdown';
import { FinancialSummary } from '@/components/dashboard/financial-summary';
import { FinancialTrendChart } from '@/components/dashboard/financial-trend-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { formatSignedIdr, ratio } from '@/lib/format-currency';
import { DashboardSkeleton } from '@/pages/dashboard';

describe('Dashboard Phase 1', () => {
    it('renders summary metrics, large BIGINT strings, negative net, comparison, and null savings rate', () => {
        const html = renderToStaticMarkup(
            createElement(FinancialSummary, {
                summary: {
                    total_balance: '9007199254740993',
                    total_income: '0',
                    total_expense: '400000',
                    net_cash_flow: '-400000',
                    savings_rate: null,
                    transaction_counts: { income: 0, expense: 1, transfer: 2 },
                    comparison: {
                        previous_start: '2026-10-01',
                        previous_end: '2026-10-31',
                        income_change: '0',
                        income_change_percentage: null,
                        expense_change: '100000',
                        expense_change_percentage: '33.33',
                        net_cash_flow_change: '-100000',
                    },
                },
            }),
        );

        expect(html).toContain('Rp9.007.199.254.740.993');
        expect(html).toContain('Rp0');
        expect(html).toContain('-Rp400.000');
        expect(html).toContain('33,33%');
        expect(html).toContain('Unavailable (no income)');
        expect(formatSignedIdr('250000')).toBe('+Rp250.000');
        expect(ratio('9007199254740993', '9007199254740993')).toBe(1);
    });

    it('renders trend chart data and empty state when all intervals are zero', () => {
        const populated = renderToStaticMarkup(
            createElement(FinancialTrendChart, {
                trends: [
                    {
                        date: '2026-11-01',
                        label: '01 Nov',
                        income: '100000',
                        expense: '25000',
                        net: '75000',
                    },
                ],
            }),
        );
        const empty = renderToStaticMarkup(
            createElement(FinancialTrendChart, {
                trends: [
                    {
                        date: '2026-11-01',
                        label: '01 Nov',
                        income: '0',
                        expense: '0',
                        net: '0',
                    },
                ],
            }),
        );

        expect(populated).toContain('Rp100.000');
        expect(populated).toContain('View data table');
        expect(empty).toContain('No income or expense in this period');
    });

    it('renders expense breakdown, account distribution, and budget progress in populated and empty states', () => {
        const expense = renderToStaticMarkup(
            createElement(ExpenseBreakdown, {
                items: [
                    {
                        category_id: 1,
                        name: 'Groceries',
                        color: '#34785A',
                        amount: '300000',
                        percentage: '75',
                    },
                ],
            }),
        );
        const accounts = renderToStaticMarkup(
            createElement(AccountDistribution, {
                items: [
                    {
                        id: 1,
                        name: 'BCA',
                        type: 'bank',
                        color: null,
                        balance: '-50000',
                        percentage: '0.00',
                    },
                ],
            }),
        );
        const budget = renderToStaticMarkup(
            createElement(BudgetOverview, {
                budgets: [
                    {
                        budget_id: 1,
                        name: 'November',
                        period_start: '2026-11-01',
                        period_end: '2026-11-30',
                        total_amount: '1000000',
                        actual_amount: '1100000',
                        remaining_amount: '-100000',
                        utilization: '110',
                        warning: 'exceeded',
                    },
                ],
            }),
        );

        expect(expense).toContain('Groceries');
        expect(expense).toContain('75%');
        expect(
            renderToStaticMarkup(
                createElement(ExpenseBreakdown, { items: [] }),
            ),
        ).toContain('No expenses in this period');
        expect(accounts).toContain('-Rp50.000');
        expect(
            renderToStaticMarkup(
                createElement(AccountDistribution, { items: [] }),
            ),
        ).toContain('No active accounts');
        expect(budget).toContain('Exceeded');
        expect(budget).toContain('Rp100.000 over');
        expect(
            renderToStaticMarkup(
                createElement(BudgetOverview, { budgets: [] }),
            ),
        ).toContain('No active budgets');
    });

    it('distinguishes income, expense, and transfer in recent transactions', () => {
        const html = renderToStaticMarkup(
            createElement(RecentTransactions, {
                transactions: [
                    {
                        id: 1,
                        type: 'income',
                        description: 'Salary',
                        amount: '5000000',
                        transaction_date: '2026-11-01',
                        account: { id: 1, name: 'BCA' },
                        source_account: null,
                        destination_account: null,
                        category: { id: 1, name: 'Paycheck' },
                    },
                    {
                        id: 2,
                        type: 'transfer',
                        description: null,
                        amount: '200000',
                        transaction_date: '2026-11-02',
                        account: null,
                        source_account: { id: 1, name: 'BCA' },
                        destination_account: { id: 2, name: 'Cash' },
                        category: null,
                    },
                ],
            }),
        );

        expect(html).toContain('+Rp5.000.000');
        expect(html).toContain('Transfer');
        expect(html).toContain('BCA → Cash');
        expect(html).not.toContain('+Rp200.000');
        expect(html).not.toContain('-Rp200.000');
        expect(
            renderToStaticMarkup(
                createElement(RecentTransactions, { transactions: [] }),
            ),
        ).toContain('No transactions yet');
    });

    it('exposes only contract-supported period filters and renders loading and error states', () => {
        expect(periodOptions.map((o) => o.value)).toEqual([
            'current_month',
            'previous_month',
            'custom',
        ]);
        expect(buildQuery('current_month', '2026-11-01', '2026-11-30')).toEqual(
            { period: 'current_month' },
        );
        expect(buildQuery('custom', '2026-11-01', '2026-11-15')).toEqual({
            period: 'custom',
            date_from: '2026-11-01',
            date_to: '2026-11-15',
        });
        expect(
            renderToStaticMarkup(createElement(DashboardSkeleton)),
        ).toContain('Loading dashboard');
        expect(
            renderToStaticMarkup(
                createElement(AlertError, {
                    title: 'Dashboard error',
                    errors: ['Unable to update the dashboard.'],
                }),
            ),
        ).toContain('role="alert"');
    });
});
