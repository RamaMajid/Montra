import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { AccountForm } from '@/components/accounts/account-form';
import {
    AccountList,
    AccountsSkeleton,
} from '@/components/accounts/account-list';
import {
    accountTypeLabels,
    accountTypes,
    type AccountItem,
} from '@/components/accounts/types';

const account: AccountItem = {
    id: 1,
    name: 'Primary bank',
    type: 'bank',
    initial_balance: '-500000',
    current_balance: '9007199254740993',
    institution: 'Montra Bank',
    description: 'Daily account',
    color: '#34785A',
    icon: 'landmark',
    is_active: true,
};

describe('accounts frontend', () => {
    it('renders every backend account type and precision-safe balances', () => {
        const html = renderToStaticMarkup(
            createElement(AccountList, {
                accounts: [
                    account,
                    {
                        ...account,
                        id: 2,
                        name: 'Old cash',
                        type: 'cash',
                        current_balance: '-1',
                        is_active: false,
                    },
                ],
                canManage: true,
                onEdit: () => undefined,
                onCreate: () => undefined,
            }),
        );
        expect(accountTypes.map(({ value }) => value)).toEqual([
            'bank',
            'e_wallet',
            'cash',
            'savings',
            'other',
        ]);
        expect(accountTypeLabels.e_wallet).toBe('E-wallet');
        expect(html).toContain('Rp9.007.199.254.740.993');
        expect(html).toContain('-Rp1');
        expect(html).toContain('Archived');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toContain('Restore');
    });

    it('renders read-only and empty states without management actions', () => {
        const readOnly = renderToStaticMarkup(
            createElement(AccountList, {
                accounts: [account],
                canManage: false,
                onEdit: () => undefined,
                onCreate: () => undefined,
            }),
        );
        const empty = renderToStaticMarkup(
            createElement(AccountList, {
                accounts: [],
                canManage: false,
                onEdit: () => undefined,
                onCreate: () => undefined,
            }),
        );
        expect(readOnly).toContain('disabled');
        expect(readOnly).not.toContain('Archive Primary bank?');
        expect(empty).toContain('No accounts yet');
        expect(empty).not.toContain('Add account');
    });

    it('renders create/edit contract fields, accessible errors, and loading state', () => {
        const create = renderToStaticMarkup(
            createElement(AccountForm, {
                account: null,
                type: 'cash',
                onTypeChange: () => undefined,
                onCancel: () => undefined,
            }),
        );
        const edit = renderToStaticMarkup(
            createElement(AccountForm, {
                account,
                type: 'bank',
                onTypeChange: () => undefined,
                onCancel: () => undefined,
            }),
        );
        expect(create).toContain('name="initial_balance"');
        expect(create).toContain('pattern="(0|[1-9][0-9]*)"');
        expect(create).toContain('name="institution"');
        expect(create).toContain('name="description"');
        expect(create).toContain('name="color"');
        expect(create).toContain('name="icon"');
        expect(edit).toContain('pattern="-?(0|[1-9][0-9]*)"');
        expect(edit).toContain('value="-500000"');
        expect(renderToStaticMarkup(createElement(AccountsSkeleton))).toContain(
            'Loading accounts',
        );
    });
});
