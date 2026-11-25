import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
};

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: Props) {
    return (
        <div
            className={cn(
                'flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center',
                className,
            )}
        >
            {Icon && (
                <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                </div>
            )}
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {description}
            </p>
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
