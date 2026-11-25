import { Form } from '@inertiajs/react';
import { useState } from 'react';
import type { RouteFormDefinition } from '@/wayfinder';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export function ArchiveDialog({
    name,
    noun,
    route,
}: {
    name: string;
    noun: 'account' | 'category';
    route: RouteFormDefinition<'post'>;
}) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setError(null);
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-warning">
                    Archive
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Archive {name}?</DialogTitle>
                <DialogDescription>
                    This {noun} stays available for financial history but cannot
                    be selected for new transactions until restored.
                </DialogDescription>
                <Form
                    {...route}
                    options={{ preserveScroll: true }}
                    onStart={() => setError(null)}
                    onSuccess={() => setOpen(false)}
                    onHttpException={() => {
                        setError(
                            `Unable to archive ${noun}. Please try again.`,
                        );
                        return false;
                    }}
                    onNetworkError={() => {
                        setError(
                            `Unable to archive ${noun}. Please try again.`,
                        );
                        return false;
                    }}
                >
                    {({ processing, errors }) => (
                        <>
                            {(error || Object.values(errors).length > 0) && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {error ??
                                        `Unable to archive ${noun}. Please try again.`}
                                </p>
                            )}
                            <DialogFooter className="mt-6">
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        autoFocus
                                    >
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={processing}
                                >
                                    {processing
                                        ? 'Archiving…'
                                        : `Archive ${noun}`}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
