import { Form, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import {
    update,
    destroy,
    transferOwnership,
} from '@/actions/App/Http/Controllers/WorkspaceController';
import {
    update as updateMember,
    destroy as removeMember,
} from '@/actions/App/Http/Controllers/WorkspaceMemberController';
import {
    store as invite,
    destroy as revoke,
} from '@/actions/App/Http/Controllers/WorkspaceInvitationController';

type Member = {
    id: number;
    user_id: number;
    role: string;
    user: { name: string; email: string };
};
type Props = {
    workspace: {
        id: number;
        name: string;
        description?: string;
        members: Member[];
    };
    membership: { user_id: number; role: string };
    invitations: Array<{
        id: number;
        email: string;
        role: string;
        expires_at: string;
    }>;
    can: {
        update: boolean;
        manageMembers: boolean;
        transferOwnership: boolean;
        delete: boolean;
    };
};
const roles = (
    <>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
        <option value="viewer">Viewer</option>
    </>
);

export default function WorkspaceShow({
    workspace,
    membership,
    invitations,
    can,
}: Props) {
    const { invitation_url } = usePage<{ invitation_url?: string }>().props;
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Workspace', href: `/workspaces/${workspace.id}` },
            ]}
        >
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
                <header>
                    <p className="text-sm text-muted-foreground">
                        {membership.role}
                    </p>
                    <h1 className="text-3xl font-semibold">{workspace.name}</h1>
                </header>
                {can.update && (
                    <Form
                        {...update.form(workspace.id)}
                        className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-6"
                    >
                        {({ errors, processing, recentlySuccessful }) => (
                            <>
                                <div>
                                    <Label htmlFor="name">Workspace name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        required
                                        defaultValue={workspace.name}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div>
                                    <Label htmlFor="description">
                                        Description
                                    </Label>
                                    <Input
                                        id="description"
                                        name="description"
                                        defaultValue={
                                            workspace.description ?? ''
                                        }
                                    />
                                    <InputError message={errors.description} />
                                </div>
                                <Button disabled={processing}>
                                    Save changes
                                </Button>
                                {recentlySuccessful && (
                                    <p role="status">Changes saved.</p>
                                )}
                            </>
                        )}
                    </Form>
                )}
                <section className="rounded-xl border bg-card p-6">
                    <h2 className="mb-4 text-lg font-medium">Members</h2>
                    <div className="divide-y">
                        {workspace.members.map((member) => (
                            <div
                                key={member.id}
                                className="flex flex-wrap items-center justify-between gap-4 py-3"
                            >
                                <div>
                                    <p className="font-medium">
                                        {member.user.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {member.user.email}
                                    </p>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {member.role}
                                </span>
                                {can.manageMembers &&
                                    member.role !== 'owner' &&
                                    member.user_id !== membership.user_id && (
                                        <div className="flex flex-wrap gap-2">
                                            <Form
                                                {...updateMember.form({
                                                    workspace: workspace.id,
                                                    member: member.id,
                                                })}
                                            >
                                                {({ processing, errors }) => (
                                                    <>
                                                        <select
                                                            name="role"
                                                            aria-label={`Role for ${member.user.name}`}
                                                            defaultValue={
                                                                member.role
                                                            }
                                                            className="rounded-md border bg-background p-2"
                                                        >
                                                            {roles}
                                                        </select>
                                                        <Button
                                                            variant="outline"
                                                            disabled={
                                                                processing
                                                            }
                                                        >
                                                            Save role
                                                        </Button>
                                                        <InputError
                                                            message={
                                                                errors.role
                                                            }
                                                        />
                                                    </>
                                                )}
                                            </Form>
                                            <Form
                                                {...removeMember.form({
                                                    workspace: workspace.id,
                                                    member: member.id,
                                                })}
                                                onBefore={() =>
                                                    confirm(
                                                        `Remove ${member.user.name}?`,
                                                    )
                                                }
                                            >
                                                {({ processing }) => (
                                                    <Button
                                                        variant="outline"
                                                        disabled={processing}
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </Form>
                                            {can.transferOwnership && (
                                                <Form
                                                    {...transferOwnership.form({
                                                        workspace: workspace.id,
                                                        member: member.id,
                                                    })}
                                                    onBefore={() =>
                                                        confirm(
                                                            `Transfer ownership to ${member.user.name}? You will become an admin.`,
                                                        )
                                                    }
                                                >
                                                    {({ processing }) => (
                                                        <Button
                                                            variant="outline"
                                                            disabled={
                                                                processing
                                                            }
                                                        >
                                                            Transfer ownership
                                                        </Button>
                                                    )}
                                                </Form>
                                            )}
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>
                </section>
                {can.manageMembers && (
                    <section className="rounded-xl border bg-card p-6">
                        <h2 className="mb-4 text-lg font-medium">
                            Invite a family member
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Invitation expires after seven days. Share the link
                            privately with the invited email address.
                        </p>
                        <Form
                            {...invite.form(workspace.id)}
                            className="flex flex-col gap-3 sm:flex-row"
                            resetOnSuccess
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grow">
                                        <Label htmlFor="invite-email">
                                            Email
                                        </Label>
                                        <Input
                                            id="invite-email"
                                            name="email"
                                            type="email"
                                            required
                                        />
                                        <InputError message={errors.email} />
                                    </div>
                                    <div>
                                        <Label htmlFor="invite-role">
                                            Role
                                        </Label>
                                        <select
                                            id="invite-role"
                                            name="role"
                                            className="block rounded-md border bg-background p-2"
                                        >
                                            {roles}
                                        </select>
                                        <InputError message={errors.role} />
                                    </div>
                                    <Button
                                        disabled={processing}
                                        className="self-end"
                                    >
                                        Create invitation
                                    </Button>
                                </>
                            )}
                        </Form>
                        {invitation_url && (
                            <div role="status" className="mt-4">
                                <Label htmlFor="invitation-url">
                                    Copy invitation link
                                </Label>
                                <Input
                                    id="invitation-url"
                                    readOnly
                                    value={invitation_url}
                                    onFocus={(event) =>
                                        event.currentTarget.select()
                                    }
                                />
                            </div>
                        )}
                        <ul className="mt-6 divide-y">
                            {invitations.map((invitation) => (
                                <li
                                    key={invitation.id}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                                >
                                    <p>
                                        {invitation.email}{' '}
                                        <span className="text-sm text-muted-foreground">
                                            ({invitation.role})
                                        </span>
                                    </p>
                                    <Form
                                        {...revoke.form({
                                            workspace: workspace.id,
                                            invitation: invitation.id,
                                        })}
                                    >
                                        {({ processing }) => (
                                            <Button
                                                variant="outline"
                                                disabled={processing}
                                            >
                                                Revoke
                                            </Button>
                                        )}
                                    </Form>
                                </li>
                            ))}
                        </ul>
                        {invitations.length === 0 && (
                            <p className="mt-4 text-sm text-muted-foreground">
                                No pending invitations.
                            </p>
                        )}
                    </section>
                )}
                {can.delete && (
                    <Form
                        {...destroy.form(workspace.id)}
                        onBefore={() =>
                            confirm(
                                'Delete this family workspace? Members will lose access.',
                            )
                        }
                    >
                        {({ processing }) => (
                            <Button variant="destructive" disabled={processing}>
                                Delete family workspace
                            </Button>
                        )}
                    </Form>
                )}
            </main>
        </AppLayout>
    );
}
