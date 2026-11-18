import { Link, usePage } from '@inertiajs/react';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import {
    ArrowLeftRight,
    CreditCard,
    FolderTree,
    FileUp,
    LayoutGrid,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Transactions',
        href: '/transactions',
        icon: ArrowLeftRight,
    },
    {
        title: 'Imports',
        href: '/imports',
        icon: FileUp,
    },
    {
        title: 'Workspaces',
        href: '/workspaces',
        icon: Users,
    },
    {
        title: 'Accounts',
        href: '/accounts',
        icon: CreditCard,
    },
    {
        title: 'Categories',
        href: '/categories',
        icon: FolderTree,
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const { workspaces, activeWorkspace } = usePage<{
        workspaces: Array<{ id: number; name: string; type: string }>;
        activeWorkspace: { id: number } | null;
    }>().props;
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeWorkspaceId={activeWorkspace?.id}
                />
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
