import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
    className?: string;
};

export function PageHeader({
    title,
    description,
    eyebrow,
    actions,
    className,
}: Props) {
    return (
        <header
            className={cn(
                'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="max-w-3xl min-w-0">
                {eyebrow && (
                    <p className="mb-2 text-sm font-medium text-primary">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance sm:text-3xl">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
            )}
        </header>
    );
}
