import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryList } from '@/components/categories/category-list';
import type { CategoryItem } from '@/components/categories/types';
import categories from '@/routes/categories';

const category: CategoryItem = {
    id: 4,
    name: 'Salary',
    type: 'income',
    description: null,
    color: null,
    icon: null,
    is_default: true,
    is_active: true,
};

describe('Categories Phase 2', () => {
    it('renders categories, preserves default editing and nullable color, and exposes management actions', () => {
        const html = renderToStaticMarkup(
            createElement(CategoryList, {
                items: [
                    category,
                    {
                        ...category,
                        id: 5,
                        name: 'Archived pay',
                        is_active: false,
                        is_default: false,
                        color: '#34785A',
                    },
                ],
                canManage: true,
                onEdit: () => undefined,
                onCreate: () => undefined,
            }),
        );

        expect(html).toContain('Salary');
        expect(html).toContain('Default');
        expect(html).toContain('Archived');
        expect(html).toContain('Edit');
        expect(html).toContain('Restore');

        const form = renderToStaticMarkup(
            createElement(CategoryForm, {
                category,
                type: 'income',
                onTypeChange: () => undefined,
                onCancel: () => undefined,
            }),
        );
        expect(form).toContain('name="color" value=""');
        expect(form).not.toContain('value="#34785A"');
        expect(form).toContain('name="type" value="income"');
        expect(form).toContain('name="description"');
        expect(form).toContain('name="icon" value=""');
    });

    it('renders empty guidance and uses generated category routes', () => {
        expect(
            renderToStaticMarkup(
                createElement(CategoryList, {
                    items: [],
                    canManage: false,
                    onEdit: () => undefined,
                    onCreate: () => undefined,
                }),
            ),
        ).toContain('No categories yet');
        const readOnlyHtml = renderToStaticMarkup(
            createElement(CategoryList, {
                items: [category],
                canManage: false,
                onEdit: () => undefined,
                onCreate: () => undefined,
            }),
        );
        expect(readOnlyHtml).not.toContain('Edit Salary');
        expect(categories.update.url(4)).toBe('/categories/4');
        expect(categories.archive.url(4)).toBe('/categories/4/archive');
        expect(categories.restore.url(4)).toBe('/categories/4/restore');
    });
});
