import { Form, Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';

export default function Invitation({
    token,
    workspaceName,
}: {
    token: string;
    workspaceName: string;
}) {
    return (
        <AppLayout>
            <Head title="Accept invitation" />
            <main className="mx-auto max-w-xl p-8">
                <section className="rounded-xl border bg-card p-6">
                    <p className="text-sm text-muted-foreground">
                        Workspace invitation
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold">
                        Join {workspaceName}
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        Confirm to join using your signed-in email address.
                    </p>
                    <Form
                        action={`/invitations/${encodeURIComponent(token)}/accept`}
                        method="post"
                        className="mt-6"
                    >
                        <Button>Join workspace</Button>
                    </Form>
                </section>
            </main>
        </AppLayout>
    );
}
