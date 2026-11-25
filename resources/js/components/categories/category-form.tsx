import { Form } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import categories from '@/routes/categories';
import {
    categoryTypeLabels,
    type CategoryItem,
    type CategoryType,
} from './types';

export function CategoryForm({
    category,
    type,
    onTypeChange,
    onCancel,
}: {
    category: CategoryItem | null;
    type: CategoryType;
    onTypeChange: (type: CategoryType) => void;
    onCancel: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const route = category
        ? categories.update.form(category.id)
        : categories.store.form();

    useEffect(() => {
        nameInputRef.current?.focus();
    }, [category?.id]);

    return (
        <section
            aria-labelledby="category-form-title"
            className="rounded-lg border border-border bg-card p-5 sm:p-6"
        >
            <div className="mb-6">
                <h2 id="category-form-title" className="text-lg font-semibold">
                    {category ? `Edit ${category.name}` : 'Add category'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Keep categories clear so reports and transaction entry stay
                    easy to scan.
                </p>
            </div>
            {error && (
                <div className="mb-5">
                    <AlertError
                        title="Unable to save category"
                        errors={[error]}
                    />
                </div>
            )}
            <Form
                {...route}
                onSuccess={onCancel}
                onStart={() => setError(null)}
                onHttpException={() => {
                    setError('Unable to save category. Please try again.');
                    return false;
                }}
                onNetworkError={() => {
                    setError('Unable to save category. Please try again.');
                    return false;
                }}
                options={{ preserveScroll: true }}
                className="grid gap-5 sm:grid-cols-2"
            >
                {({ errors, processing }) => (
                    <>
                        <Field
                            label="Category name"
                            id="category-name"
                            error={errors.name}
                            required
                        >
                            <Input
                                ref={nameInputRef}
                                id="category-name"
                                name="name"
                                required
                                maxLength={255}
                                defaultValue={category?.name ?? ''}
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={
                                    errors.name
                                        ? 'category-name-error'
                                        : undefined
                                }
                            />
                        </Field>
                        <Field
                            label="Category type"
                            id="category-type"
                            error={errors.type}
                            required
                            description={
                                category
                                    ? 'Category type cannot be changed after creation.'
                                    : undefined
                            }
                        >
                            {category && (
                                <input
                                    type="hidden"
                                    name="type"
                                    value={category.type}
                                />
                            )}
                            <select
                                id="category-type"
                                name="type"
                                required
                                disabled={Boolean(category)}
                                value={category?.type ?? type}
                                onChange={(event) =>
                                    onTypeChange(
                                        event.target.value as CategoryType,
                                    )
                                }
                                aria-invalid={Boolean(errors.type)}
                                aria-describedby={
                                    [
                                        category
                                            ? 'category-type-description'
                                            : null,
                                        errors.type
                                            ? 'category-type-error'
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' ') || undefined
                                }
                                className="h-12 w-full rounded-md border border-input bg-surface px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:text-sm"
                            >
                                {(
                                    Object.keys(
                                        categoryTypeLabels,
                                    ) as CategoryType[]
                                ).map((value) => (
                                    <option key={value} value={value}>
                                        {categoryTypeLabels[value]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label="Description"
                            id="category-description"
                            error={errors.description}
                            className="sm:col-span-2"
                        >
                            <textarea
                                id="category-description"
                                name="description"
                                maxLength={2000}
                                defaultValue={category?.description ?? ''}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={
                                    errors.description
                                        ? 'category-description-error'
                                        : undefined
                                }
                                className="min-h-24 w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-sm"
                            />
                        </Field>
                        <Field
                            label="Color"
                            id="category-color"
                            error={errors.color}
                            description="Optional six-digit hex color, for example #34785A."
                        >
                            <Input
                                id="category-color"
                                name="color"
                                pattern="#[0-9a-fA-F]{6}"
                                defaultValue={category?.color ?? ''}
                                placeholder="#34785A"
                                aria-invalid={Boolean(errors.color)}
                                aria-describedby={
                                    errors.color
                                        ? 'category-color-description category-color-error'
                                        : 'category-color-description'
                                }
                            />
                        </Field>
                        <Field
                            label="Icon identifier"
                            id="category-icon"
                            error={errors.icon}
                            description="Optional stored icon name."
                        >
                            <Input
                                id="category-icon"
                                name="icon"
                                maxLength={64}
                                defaultValue={category?.icon ?? ''}
                                placeholder="shopping-bag"
                                aria-invalid={Boolean(errors.icon)}
                                aria-describedby={
                                    errors.icon
                                        ? 'category-icon-description category-icon-error'
                                        : 'category-icon-description'
                                }
                            />
                        </Field>
                        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}{' '}
                                {processing
                                    ? 'Saving…'
                                    : category
                                      ? 'Save changes'
                                      : 'Create category'}
                            </Button>
                        </div>
                    </>
                )}
            </Form>
        </section>
    );
}

function Field({
    label,
    id,
    error,
    description,
    required,
    className,
    children,
}: {
    label: string;
    id: string;
    error?: string;
    description?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`grid gap-2 ${className ?? ''}`}>
            <Label htmlFor={id}>
                {label}
                {required && (
                    <span aria-hidden="true" className="text-destructive">
                        {' '}
                        *
                    </span>
                )}
            </Label>
            {children}
            {description && (
                <p
                    id={`${id}-description`}
                    className="text-xs leading-5 text-muted-foreground"
                >
                    {description}
                </p>
            )}
            <InputError id={`${id}-error`} message={error} />
        </div>
    );
}
