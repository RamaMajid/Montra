import { Form, Link } from '@inertiajs/react';
import { Building2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarGroup } from '@/components/ui/sidebar';

type Workspace = { id: number; name: string; type: string; role: string };

export function WorkspaceSwitcher({
    workspaces,
    activeWorkspaceId,
}: {
    workspaces: Workspace[];
    activeWorkspaceId?: number;
}) {
    const activeWorkspace = workspaces.find(
        (workspace) => workspace.id === activeWorkspaceId,
    );

    if (!activeWorkspace) {
        return null;
    }

    if (workspaces.length < 2) {
        return (
            <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:hidden">
                <Link
                    href="/workspaces"
                    className="flex min-h-12 items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/35 px-3 text-sm transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    <Building2 aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                        {activeWorkspace.name}
                    </span>
                    <span className="text-xs text-sidebar-foreground/55 capitalize">
                        {activeWorkspace.role}
                    </span>
                </Link>
            </SidebarGroup>
        );
    }

    return (
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:hidden">
            <Form action="/workspaces/active" method="post">
                <label className="sr-only" htmlFor="active-workspace">
                    Active workspace
                </label>
                <div className="relative">
                    <Building2
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/60"
                    />
                    <select
                        id="active-workspace"
                        name="workspace_id"
                        defaultValue={activeWorkspaceId}
                        className="h-12 w-full appearance-none rounded-md border border-sidebar-border bg-sidebar-accent/35 pr-9 pl-10 text-sm font-medium transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                        onChange={(event) =>
                            event.currentTarget.form?.requestSubmit()
                        }
                    >
                        {workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                                {workspace.name} ({workspace.type})
                            </option>
                        ))}
                    </select>
                    <ChevronsUpDown
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-sidebar-foreground/60"
                    />
                </div>
                <Button className="sr-only" type="submit">
                    Switch workspace
                </Button>
            </Form>
        </SidebarGroup>
    );
}
