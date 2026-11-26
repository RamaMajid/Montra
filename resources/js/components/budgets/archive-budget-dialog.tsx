import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import budgets from '@/routes/budgets';
import type { BudgetItem } from './types';

export function ArchiveBudgetForm({
    budget,
    onCancel,
    onSuccess,
}: {
    budget: BudgetItem;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const [error, setError] = useState<string | null>(null);

    return (
        <Form
            {...budgets.archive.form(budget.id)}
            options={{ preserveScroll: true }}
            onStart={() => setError(null)}
            onSuccess={onSuccess}
            onHttpException={() => {
                setError('Unable to archive budget. Please try again.');
                return false;
            }}
            onNetworkError={() => {
                setError('Unable to archive budget. Please try again.');
                return false;
            }}
        >
            {({ processing, errors }) => (
                <>
                    {(error || Object.keys(errors).length > 0) && (
                        <p role="alert" className="text-sm text-destructive">
                            {error ??
                                'Unable to archive budget. Please try again.'}
                        </p>
                    )}
                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            autoFocus
                            onClick={onCancel}
                        >
                            Keep budget
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing}
                        >
                            {processing && <Spinner />}
                            {processing ? 'Archiving…' : 'Archive budget'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

export function ArchiveBudgetDialog({
    budget,
    open,
    onOpenChange,
}: {
    budget: BudgetItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!budget) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Archive {budget.name}?</DialogTitle>
                    <DialogDescription>
                        This monthly budget remains available in budget history,
                        but can no longer be edited. Archiving does not change
                        transactions or account balances.
                    </DialogDescription>
                </DialogHeader>
                <ArchiveBudgetForm
                    budget={budget}
                    onCancel={() => onOpenChange(false)}
                    onSuccess={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}
