import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import AlertError from '@/components/alert-error';
import {
    analyticsPeriodOptions,
    buildAnalyticsQuery,
} from '@/components/analytics/analytics-period-filter';
import { CategoryTrends } from '@/components/analytics/category-trends';
import { TrendAnalysis } from '@/components/analytics/trend-analysis';
import { AccountDistribution } from '@/components/dashboard/account-distribution';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import { ExpenseBreakdown } from '@/components/dashboard/expense-breakdown';
import { FinancialSummary } from '@/components/dashboard/financial-summary';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { AnalyticsSkeleton } from '@/pages/analytics/index';
import analytics from '@/routes/analytics';

describe('Analytics Phase 6', () => {
    it('uses generated Wayfinder analytics.page route and contract-supported filters', () => {
        expect(analytics.page.url()).toBe('/analytics/page');
        expect(analyticsPeriodOptions.map((option) => option.value)).toEqual([
            'current_month',
            'previous_month',
            'custom',
        ]);
        expect(
            buildAnalyticsQuery('current_month', '2026-11-01', '2026-11-30'),
        ).toEqual({
            period: 'current_month',
        });
        expect(
            buildAnalyticsQuery('previous_month', '2026-10-01', '2026-10-31'),
        ).toEqual({
            period: 'previous_month',
        });
        expect(
            buildAnalyticsQuery('custom', '2026-11-01', '2026-11-15'),
        ).toEqual({
            period: 'custom',
            date_from: '2026-11-01',
            date_to: '2026-11-15',
        });
    });

    it('renders trend analysis with BIGINT scaling, savings rate unavailable semantics, accessible table, and empty state', () => {
        const html = renderToStaticMarkup(
            createElement(TrendAnalysis, {
                trends: [
                    {
                        date: '2026-11-01',
                        label: '01 Nov',
                        income: '9007199254740993',
                        expense: '400000',
                        net: '9007199254340993',
                    },
                    {
                        date: '2026-11-02',
                        label: '02 Nov',
                        income: '0',
                        expense: '150000',
                        net: '-150000',
                    },
                ],
                savingsRates: [
                    {
                        date: '2026-11-01',
                        label: '01 Nov',
                        savings_rate: '100',
                    },
                    { date: '2026-11-02', label: '02 Nov', savings_rate: null },
                ],
            }),
        );

        expect(html).toContain('Rp9.007.199.254.740.993');
        expect(html).toContain('100%');
        expect(html).toContain('>—<');
        expect(html).not.toContain('>0%<');
        expect(html).toContain('View data table');
        expect(html).toContain('role="region"');
        expect(
            renderToStaticMarkup(
                createElement(TrendAnalysis, {
                    trends: [
                        {
                            date: '2026-11-01',
                            label: '01 Nov',
                            income: '0',
                            expense: '0',
                            net: '0',
                        },
                    ],
                    savingsRates: [
                        {
                            date: '2026-11-01',
                            label: '01 Nov',
                            savings_rate: null,
                        },
                    ],
                }),
            ),
        ).toContain('No income or expenses in this period');
    });

    it('renders category trends with daily and monthly intervals, accessible table, and empty state', () => {
        const html = renderToStaticMarkup(
            createElement(CategoryTrends, {
                items: [
                    {
                        category_id: 1,
                        name: 'Groceries',
                        color: '#34785A',
                        icon: null,
                        intervals: [
                            { date: '2026-11-01', amount: '250000' },
                            { date: '2026-12', amount: '500000' },
                        ],
                    },
                ],
            }),
        );

        expect(html).toContain('Groceries');
        expect(html).toContain('Rp250.000');
        expect(html).toContain('Rp500.000');
        expect(html).toContain('View Groceries values');
        expect(
            renderToStaticMarkup(createElement(CategoryTrends, { items: [] })),
        ).toContain('No category trends');
    });

    it('renders summary, expense breakdown, account distribution, budget context, recent transactions, loading, and error states', () => {
        const summary = renderToStaticMarkup(
            createElement(FinancialSummary, {
                summary: {
                    total_balance: '1200000',
                    total_income: '0',
                    total_expense: '300000',
                    net_cash_flow: '-300000',
                    savings_rate: null,
                    transaction_counts: { income: 0, expense: 1, transfer: 1 },
                    comparison: {
                        previous_start: '2026-10-01',
                        previous_end: '2026-10-31',
                        income_change: '0',
                        income_change_percentage: null,
                        expense_change: '50000',
                        expense_change_percentage: '20',
                        net_cash_flow_change: '-50000',
                    },
                },
            }),
        );

        expect(summary).toContain('Unavailable (no income)');
        expect(
            renderToStaticMarkup(
                createElement(ExpenseBreakdown, { items: [] }),
            ),
        ).toContain('No expenses in this period');
        expect(
            renderToStaticMarkup(
                createElement(AccountDistribution, { items: [] }),
            ),
        ).toContain('No active accounts');
        expect(
            renderToStaticMarkup(
                createElement(BudgetOverview, { budgets: [] }),
            ),
        ).toContain('No active budgets');
        expect(
            renderToStaticMarkup(
                createElement(RecentTransactions, { transactions: [] }),
            ),
        ).toContain('No transactions yet');
        expect(
            renderToStaticMarkup(createElement(AnalyticsSkeleton)),
        ).toContain('Loading analytics');
        expect(
            renderToStaticMarkup(
                createElement(AlertError, {
                    title: 'Analytics error',
                    errors: ['Unable to update analytics.'],
                }),
            ),
        ).toContain('role="alert"');
    });
});
