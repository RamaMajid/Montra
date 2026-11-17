import { Form } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type Workspace = { id: number; name: string; type: string };

export function WorkspaceSwitcher({
    workspaces,
    activeWorkspaceId,
}: {
    workspaces: Workspace[];
    activeWorkspaceId?: number;
}) {
    if (workspaces.length < 2) return null;

    return (
        <Form action="/workspaces/active" method="post" className="px-2 pb-2">
            <select
                name="workspace_id"
                aria-label="Active workspace"
                defaultValue={activeWorkspaceId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
                {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                        {workspace.name} ({workspace.type})
                    </option>
                ))}
            </select>
            <Button className="sr-only" type="submit">
                Switch workspace
            </Button>
        </Form>
    );
}
