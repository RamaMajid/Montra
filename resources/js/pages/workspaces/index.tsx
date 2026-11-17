import { Form } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

export default function WorkspacesIndex({
    workspaces,
}: {
    workspaces: Array<{ id: number; name: string; type: string; role: string }>;
}) {
    return (
        <AppLayout breadcrumbs={[{ title: 'Workspaces', href: '/workspaces' }]}>
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
                <header>
                    <p className="text-sm text-muted-foreground">Your spaces</p>
                    <h1 className="text-3xl font-semibold">Workspaces</h1>
                </header>
                <section className="grid gap-4 sm:grid-cols-2">
                    {workspaces.map((workspace) => (
                        <a
                            key={workspace.id}
                            href={`/workspaces/${workspace.id}`}
                            className="rounded-xl border bg-card p-5 transition hover:border-primary"
                        >
                            <h2 className="font-medium">{workspace.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {workspace.type} · {workspace.role}
                            </p>
                        </a>
                    ))}
                </section>
                <section className="max-w-md rounded-xl border bg-card p-6">
                    <h2 className="mb-4 text-lg font-medium">
                        Create family workspace
                    </h2>
                    <Form
                        action="/workspaces"
                        method="post"
                        className="flex flex-col gap-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div>
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" required />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="description">
                                        Description
                                    </Label>
                                    <Input
                                        id="description"
                                        name="description"
                                    />
                                </div>
                                <Button disabled={processing}>
                                    Create workspace
                                </Button>
                            </>
                        )}
                    </Form>
                </section>
            </main>
        </AppLayout>
    );
}
