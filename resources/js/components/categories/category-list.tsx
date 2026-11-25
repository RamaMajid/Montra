import { Form } from '@inertiajs/react';
import { Pencil, RotateCcw, Tags } from 'lucide-react';
import { useState } from 'react';
import { ArchiveDialog } from '@/components/archive-dialog';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import categories from '@/routes/categories';
import {
    categoryTypeLabels,
    type CategoryItem,
    type CategoryType,
} from './types';

export function CategoryList({
    items,
    canManage,
    onEdit,
    onCreate,
}: {
    items: CategoryItem[];
    canManage: boolean;
    onEdit: (category: CategoryItem) => void;
    onCreate: () => void;
}) {
    if (items.length === 0) {
        return (
            <EmptyState
                icon={Tags}
                title="No categories yet"
                description="Add income and expense categories to organize transactions and reports."
                action={
                    canManage ? (
                        <Button onClick={onCreate}>Add category</Button>
                    ) : undefined
                }
            />
        );
    }

    return (
        <div className="grid gap-7 lg:grid-cols-2">
            {(['income', 'expense'] as CategoryType[]).map((type) => {
                const typedItems = items.filter((item) => item.type === type);
                return (
                    <section
                        key={type}
                        aria-labelledby={`${type}-categories-title`}
                    >
                        <div className="mb-3 flex items-baseline justify-between gap-4">
                            <h2
                                id={`${type}-categories-title`}
                                className="text-lg font-semibold"
                            >
                                {categoryTypeLabels[type]}
                            </h2>
                            <p className="font-numeric text-sm text-muted-foreground">
                                {typedItems.length}{' '}
                                {typedItems.length === 1
                                    ? 'category'
                                    : 'categories'}
                            </p>
                        </div>
                        {typedItems.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
                                No {type} categories.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {typedItems.map((category) => (
                                    <CategoryCard
                                        key={category.id}
                                        category={category}
                                        canManage={canManage}
                                        onEdit={onEdit}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

function CategoryCard({
    category,
    canManage,
    onEdit,
}: {
    category: CategoryItem;
    canManage: boolean;
    onEdit: (category: CategoryItem) => void;
}) {
    const [error, setError] = useState<string | null>(null);

    return (
        <article
            className={`rounded-lg border bg-card p-4 sm:p-5 ${category.is_active ? 'border-border' : 'border-border/70 opacity-75'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        aria-hidden="true"
                        className="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-background"
                        style={{
                            backgroundColor:
                                category.color ??
                                (category.type === 'income'
                                    ? 'var(--income)'
                                    : 'var(--expense)'),
                        }}
                    />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold break-words">
                                {category.name}
                            </h3>
                            {category.is_default && (
                                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Default
                                </span>
                            )}
                            {!category.is_active && (
                                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                    Archived
                                </span>
                            )}
                        </div>
                        {category.icon && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Icon: {category.icon}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            {category.description && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {category.description}
                </p>
            )}
            {canManage && (
                <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-border pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => onEdit(category)}
                    >
                        <Pencil /> Edit
                    </Button>
                    {category.is_active ? (
                        <ArchiveDialog
                            name={category.name}
                            noun="category"
                            route={categories.archive.form(category.id)}
                        />
                    ) : (
                        <Form
                            {...categories.restore.form(category.id)}
                            options={{ preserveScroll: true }}
                            onHttpException={() => {
                                setError(
                                    'Unable to restore category. Please try again.',
                                );
                                return false;
                            }}
                            onNetworkError={() => {
                                setError(
                                    'Unable to restore category. Please try again.',
                                );
                                return false;
                            }}
                            onStart={() => setError(null)}
                        >
                            {({ processing, errors }) => (
                                <>
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="sm"
                                        aria-label={`Restore ${category.name}`}
                                        disabled={processing}
                                    >
                                        <RotateCcw />{' '}
                                        {processing ? 'Restoring…' : 'Restore'}
                                    </Button>
                                    {(error ||
                                        Object.values(errors).length > 0) && (
                                        <p
                                            role="alert"
                                            className="w-full text-right text-sm text-destructive"
                                        >
                                            {error ??
                                                'Unable to restore category.'}
                                        </p>
                                    )}
                                </>
                            )}
                        </Form>
                    )}
                </div>
            )}
        </article>
    );
}
