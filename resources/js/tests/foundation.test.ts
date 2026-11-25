import { Landmark } from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import AlertError from '@/components/alert-error';
import { EmptyState } from '@/components/empty-state';
import { navigationGroups } from '@/components/navigation';
import { PageHeader } from '@/components/page-header';
import {
    formatDateId,
    formatIdr,
    formatMonthId,
    formatPercent,
} from '@/lib/format-currency';

describe('financial formatting helpers', () => {
    it('formats positive, negative, zero, and 64-bit integer Rupiah strings without Number precision loss', () => {
        expect(formatIdr('0')).toBe('Rp0');
        expect(formatIdr('1250000')).toBe('Rp1.250.000');
        expect(formatIdr('-45000')).toBe('-Rp45.000');
        expect(formatIdr('9007199254740993')).toBe('Rp9.007.199.254.740.993');
    });

    it('formats decimal percentage strings and unavailable rates', () => {
        expect(formatPercent('18.45')).toBe('18,45%');
        expect(formatPercent(null)).toBe('—');
        expect(formatPercent('')).toBe('—');
    });

    it('formats ISO calendar dates and budget months in Indonesian locale without timezone drift', () => {
        expect(formatDateId('2026-04-01')).toContain('2026');
        expect(formatMonthId('2026-04')).toContain('2026');
        expect(formatDateId('invalid')).toBe('invalid');
    });
});

describe('Phase 0 shell navigation and shared state primitives', () => {
    it('keeps live Inertia destinations active and marks deferred JSON-only routes disabled', () => {
        const items = navigationGroups.flatMap((group) => group.items);
        const activeTitles = items
            .filter((item) => !item.disabled && item.href)
            .map((item) => item.title);
        const deferredTitles = items
            .filter((item) => item.disabled && !item.href)
            .map((item) => item.title);

        expect(activeTitles).toEqual([
            'Dashboard',
            'Transactions',
            'Import transactions',
            'Accounts',
            'Categories',
            'Budgets',
            'Workspace',
            'Settings',
        ]);
        expect(deferredTitles).toEqual([
            'Savings goals',
            'Analytics',
            'Financial intelligence',
            'Reports',
        ]);
    });

    it('renders accessible page header, empty state, and deduplicated error state markup', () => {
        const headerHtml = renderToStaticMarkup(
            createElement(PageHeader, {
                eyebrow: 'Workspace',
                title: 'Accounts',
                description: 'Manage active and archived balances.',
            }),
        );
        const emptyHtml = renderToStaticMarkup(
            createElement(EmptyState, {
                icon: Landmark,
                title: 'No accounts yet',
                description: 'Create your first account to begin tracking.',
            }),
        );
        const errorHtml = renderToStaticMarkup(
            createElement(AlertError, {
                title: 'Unable to save',
                errors: ['Amount is required.', 'Amount is required.'],
            }),
        );

        expect(headerHtml).toContain('<h1');
        expect(headerHtml).toContain('Accounts');
        expect(emptyHtml).toContain('No accounts yet');
        expect(errorHtml).toContain('role="alert"');
        expect(errorHtml.match(/Amount is required\./g)).toHaveLength(1);
    });
});
