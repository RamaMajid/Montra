import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryList } from '@/components/categories/category-list';
import {
    type CategoryItem,
    type CategoriesProps,
    type CategoryType,
} from '@/components/categories/types';
import AlertError from '@/components/alert-error';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import categories from '@/routes/categories';

export default function CategoriesIndex({
    categories: items,
    canManage,
}: CategoriesProps) {
    const [editing, setEditing] = useState<CategoryItem | null>(null);
    const [creating, setCreating] = useState(false);
    const [type, setType] = useState<CategoryType>('expense');

    const openCreate = () => {
        setEditing(null);
        setType('expense');
        setCreating(true);
    };
    const openEdit = (category: CategoryItem) => {
        setCreating(false);
        setEditing(category);
        setType(category.type);
    };
    const closeForm = () => {
        setCreating(false);
        setEditing(null);
    };

    return (
        <>
            <Head title="Categories" />
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
                <PageHeader
                    eyebrow="Workspace"
                    title="Categories"
                    description="Organize income and expenses with categories shared across this workspace."
                    actions={
                        canManage && !creating && !editing ? (
                            <Button onClick={openCreate}>Add category</Button>
                        ) : undefined
                    }
                />
                {canManage && (creating || editing) && (
                    <CategoryForm
                        key={editing?.id ?? 'new-category'}
                        category={editing}
                        type={type}
                        onTypeChange={setType}
                        onCancel={closeForm}
                    />
                )}
                {items.length > 0 && (
                    <section
                        aria-label="Category overview"
                        className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-border py-4"
                    >
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Categories
                            </p>
                            <p className="font-numeric mt-1 text-lg font-semibold">
                                {items.length}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Active
                            </p>
                            <p className="font-numeric mt-1 text-lg font-semibold">
                                {items.filter((item) => item.is_active).length}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Archived
                            </p>
                            <p className="font-numeric mt-1 text-lg font-semibold">
                                {items.filter((item) => !item.is_active).length}
                            </p>
                        </div>
                    </section>
                )}
                <CategoryList
                    items={items}
                    canManage={canManage}
                    onEdit={openEdit}
                    onCreate={openCreate}
                />
                <noscript>
                    <AlertError
                        title="JavaScript required"
                        errors={['Enable JavaScript to manage categories.']}
                    />
                </noscript>
            </main>
        </>
    );
}

CategoriesIndex.layout = {
    breadcrumbs: [{ title: 'Categories', href: categories.index.url() }],
};
