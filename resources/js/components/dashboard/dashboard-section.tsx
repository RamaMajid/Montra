import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DashboardSection({
    id,
    title,
    description,
    className,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={id}
            className={cn(
                'min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6',
                className,
            )}
        >
            <header className="mb-5">
                <h2 id={id} className="text-base font-semibold tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </header>
            {children}
        </section>
    );
}
