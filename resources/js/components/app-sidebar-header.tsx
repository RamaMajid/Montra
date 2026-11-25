import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    return (
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm transition-[width,height] ease-linear sm:px-6 lg:min-h-20">
            <SidebarTrigger
                className="size-10 rounded-md border border-border/80 bg-surface text-foreground hover:bg-accent"
                aria-label="Toggle navigation"
            />
            <div className="min-w-0 flex-1">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="hidden text-right sm:block">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                    Understand your money.
                </p>
                <p className="text-xs text-muted-foreground">
                    Own your future.
                </p>
            </div>
        </header>
    );
}
