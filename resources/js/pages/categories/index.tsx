import { useState } from 'react';
import { Form, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { Archive, Plus, RotateCcw } from 'lucide-react';

export type CategoryItem = {
    id: number;
    name: string;
    type: 'income' | 'expense';
    description: string | null;
    color: string | null;
    icon: string | null;
    is_default: boolean;
    is_active: boolean;
};

type Props = {
    categories: CategoryItem[];
    canManage: boolean;
};

export default function CategoriesIndex({ categories, canManage }: Props) {
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(
        'all',
    );
    const [editing, setEditing] = useState<CategoryItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>(
        'expense',
    );

    const filtered = categories.filter((c) => {
        if (filterType === 'all') return true;
        return c.type === filterType;
    });

    const incomeCategories = filtered.filter((c) => c.type === 'income');
    const expenseCategories = filtered.filter((c) => c.type === 'expense');

    return (
        <AppLayout breadcrumbs={[{ title: 'Categories', href: '/categories' }]}>
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-emerald-500">
                            Workspace
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            Categories
                        </h1>
                    </div>
                    {canManage && !isCreating && !editing && (
                        <Button
                            onClick={() => {
                                setIsCreating(true);
                                setCategoryType('expense');
                            }}
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add category
                        </Button>
                    )}
                </header>

                <div className="flex gap-2 border-b border-border pb-3">
                    <Button
                        variant={filterType === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilterType('all')}
                    >
                        All
                    </Button>
                    <Button
                        variant={filterType === 'income' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilterType('income')}
                    >
                        Income
                    </Button>
                    <Button
                        variant={filterType === 'expense' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setFilterType('expense')}
                    >
                        Expense
                    </Button>
                </div>

                {canManage && (isCreating || editing) && (
                    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-medium text-foreground">
                                {editing
                                    ? `Edit: ${editing.name}`
                                    : 'New category'}
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditing(null);
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                        <Form
                            action={
                                editing
                                    ? `/categories/${editing.id}`
                                    : '/categories'
                            }
                            method={editing ? 'put' : 'post'}
                            onSuccess={() => {
                                setIsCreating(false);
                                setEditing(null);
                            }}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="sm:col-span-1">
                                        <Label htmlFor="category-name">
                                            Name
                                        </Label>
                                        <Input
                                            id="category-name"
                                            name="name"
                                            required
                                            defaultValue={editing?.name ?? ''}
                                            placeholder="e.g. Groceries"
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="category-type">
                                            Type
                                        </Label>
                                        {editing ? (
                                            <input
                                                type="hidden"
                                                name="type"
                                                value={editing.type}
                                            />
                                        ) : null}
                                        <select
                                            id="category-type"
                                            name="type"
                                            disabled={!!editing}
                                            value={
                                                editing
                                                    ? editing.type
                                                    : categoryType
                                            }
                                            onChange={(e) =>
                                                setCategoryType(
                                                    e.target.value as
                                                        | 'income'
                                                        | 'expense',
                                                )
                                            }
                                            className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                                        >
                                            <option value="expense">
                                                Expense
                                            </option>
                                            <option value="income">
                                                Income
                                            </option>
                                        </select>
                                        {editing && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Category type is immutable after
                                                creation.
                                            </p>
                                        )}
                                        <InputError message={errors.type} />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <Label htmlFor="category-description">
                                            Description
                                        </Label>
                                        <Input
                                            id="category-description"
                                            name="description"
                                            defaultValue={
                                                editing?.description ?? ''
                                            }
                                            placeholder="Optional description"
                                        />
                                        <InputError
                                            message={errors.description}
                                        />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="category-color">
                                            Color (hex)
                                        </Label>
                                        <Input
                                            id="category-color"
                                            name="color"
                                            defaultValue={
                                                editing?.color ?? '#34785A'
                                            }
                                            placeholder="#34785A"
                                        />
                                        <InputError message={errors.color} />
                                    </div>

                                    <div className="sm:col-span-1">
                                        <Label htmlFor="category-icon">
                                            Icon identifier
                                        </Label>
                                        <Input
                                            id="category-icon"
                                            name="icon"
                                            defaultValue={editing?.icon ?? ''}
                                            placeholder="e.g. tag, shopping-bag"
                                        />
                                        <InputError message={errors.icon} />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsCreating(false);
                                                setEditing(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            disabled={processing}
                                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                                        >
                                            {editing
                                                ? 'Update category'
                                                : 'Create category'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </section>
                )}

                <div className="space-y-8">
                    {(filterType === 'all' || filterType === 'income') && (
                        <section>
                            <h2 className="mb-3 text-lg font-medium text-emerald-500">
                                Income Categories
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {incomeCategories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className={`flex items-center justify-between rounded-lg border bg-card p-4 transition ${
                                            cat.is_active
                                                ? 'border-border'
                                                : 'border-border/50 bg-card/60 opacity-70'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="h-3 w-3 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        cat.color || '#34785A',
                                                }}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-foreground">
                                                        {cat.name}
                                                    </p>
                                                    {cat.is_default && (
                                                        <span className="py-0.2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                            Default
                                                        </span>
                                                    )}
                                                    {!cat.is_active && (
                                                        <span className="py-0.2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                                {cat.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {cat.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {canManage && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditing(cat);
                                                        setIsCreating(false);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                {cat.is_active ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Archive ${cat.name}`}
                                                        onClick={() =>
                                                            router.post(
                                                                `/categories/${cat.id}/archive`,
                                                            )
                                                        }
                                                        className="text-amber-500 hover:text-amber-600"
                                                    >
                                                        <Archive className="h-3.5 w-3.5" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Restore ${cat.name}`}
                                                        onClick={() =>
                                                            router.post(
                                                                `/categories/${cat.id}/restore`,
                                                            )
                                                        }
                                                        className="text-emerald-500 hover:text-emerald-600"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {(filterType === 'all' || filterType === 'expense') && (
                        <section>
                            <h2 className="mb-3 text-lg font-medium text-rose-500">
                                Expense Categories
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {expenseCategories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        className={`flex items-center justify-between rounded-lg border bg-card p-4 transition ${
                                            cat.is_active
                                                ? 'border-border'
                                                : 'border-border/50 bg-card/60 opacity-70'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="h-3 w-3 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        cat.color || '#E57373',
                                                }}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-foreground">
                                                        {cat.name}
                                                    </p>
                                                    {cat.is_default && (
                                                        <span className="py-0.2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                            Default
                                                        </span>
                                                    )}
                                                    {!cat.is_active && (
                                                        <span className="py-0.2 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>
                                                {cat.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {cat.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {canManage && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditing(cat);
                                                        setIsCreating(false);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                {cat.is_active ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Archive ${cat.name}`}
                                                        onClick={() =>
                                                            router.post(
                                                                `/categories/${cat.id}/archive`,
                                                            )
                                                        }
                                                        className="text-amber-500 hover:text-amber-600"
                                                    >
                                                        <Archive className="h-3.5 w-3.5" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Restore ${cat.name}`}
                                                        onClick={() =>
                                                            router.post(
                                                                `/categories/${cat.id}/restore`,
                                                            )
                                                        }
                                                        className="text-emerald-500 hover:text-emerald-600"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
