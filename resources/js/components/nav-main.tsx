import { Link } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavGroup, NavGroupItem } from '@/types';

type Props = {
    groups: NavGroup[];
};

function NavButton({ item }: { item: NavGroupItem }) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const Icon = item.icon;
    const isActive = item.href ? isCurrentOrParentUrl(item.href) : false;

    const content = (
        <>
            {Icon && <Icon aria-hidden="true" />}
            <span>{item.title}</span>
            {item.hint && <span className="ml-auto text-xs">{item.hint}</span>}
        </>
    );

    const props: ComponentProps<typeof SidebarMenuButton> = {
        isActive,
        tooltip: { children: item.title },
        className:
            'min-h-9 rounded-md text-sidebar-foreground/75 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground',
    };

    if (item.disabled || !item.href) {
        return (
            <SidebarMenuButton {...props} disabled>
                {content}
            </SidebarMenuButton>
        );
    }

    return (
        <SidebarMenuButton {...props} asChild>
            <Link
                href={item.href}
                prefetch
                aria-current={isActive ? 'page' : undefined}
            >
                {content}
            </Link>
        </SidebarMenuButton>
    );
}

export function NavMain({ groups }: Props) {
    return (
        <nav aria-label="Primary navigation">
            {groups.map((group) => (
                <SidebarGroup
                    key={group.label}
                    className="px-3 py-2 first:pt-1"
                >
                    <SidebarGroupLabel className="px-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-sidebar-foreground/50">
                        {group.label}
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <NavButton item={item} />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </nav>
    );
}
