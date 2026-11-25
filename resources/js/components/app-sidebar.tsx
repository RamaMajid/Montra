import { Link, usePage } from '@inertiajs/react';
import AppLogo from '@/components/app-logo';
import { navigationGroups } from '@/components/navigation';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
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

const footerNavItems: NavItem[] = [];

type Workspace = { id: number; name: string; type: string; role: string };

export function AppSidebar() {
    const { workspaces, activeWorkspace } = usePage<{
        workspaces: Workspace[];
        activeWorkspace: Workspace | null;
    }>().props;

    return (
        <Sidebar
            collapsible="icon"
            variant="inset"
            className="border-sidebar-border"
        >
            <SidebarHeader className="p-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="hover:bg-transparent"
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-0 px-1">
                <WorkspaceSwitcher
                    workspaces={workspaces}
                    activeWorkspaceId={activeWorkspace?.id}
                />
                <NavMain groups={navigationGroups} />
            </SidebarContent>

            <SidebarFooter className="p-3">
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
