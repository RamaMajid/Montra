import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ImportRowStatus } from './types';

export function ImportStatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'completed':
            return (
                <Badge
                    variant="outline"
                    className="border-income/40 bg-income/10 text-income"
                >
                    <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                    Completed
                </Badge>
            );
        case 'completed_with_errors':
            return (
                <Badge
                    variant="outline"
                    className="border-warning/40 bg-warning/10 text-warning"
                >
                    <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
                    Completed with errors
                </Badge>
            );
        case 'queued':
        case 'processing':
            return (
                <Badge
                    variant="outline"
                    className="border-transfer/40 bg-transfer/10 text-transfer"
                >
                    <RefreshCw
                        aria-hidden="true"
                        className="mr-1 size-3 animate-spin"
                    />
                    {status === 'queued' ? 'Queued' : 'Processing'}
                </Badge>
            );
        case 'previewed':
            return (
                <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary/10 text-primary"
                >
                    <Clock aria-hidden="true" className="mr-1 size-3" />
                    Previewed
                </Badge>
            );
        case 'failed':
            return (
                <Badge
                    variant="outline"
                    className="border-destructive/40 bg-destructive/10 text-destructive"
                >
                    <AlertCircle aria-hidden="true" className="mr-1 size-3" />
                    Failed
                </Badge>
            );
        default:
            return (
                <Badge
                    variant="outline"
                    className="border-border text-muted-foreground"
                >
                    <Clock aria-hidden="true" className="mr-1 size-3" />
                    Uploaded
                </Badge>
            );
    }
}

export function ImportRowStatusBadge({ status }: { status: ImportRowStatus }) {
    switch (status) {
        case 'valid':
            return (
                <Badge
                    variant="outline"
                    className="border-income/40 bg-income/10 text-income"
                >
                    <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                    Valid
                </Badge>
            );
        case 'imported':
            return (
                <Badge
                    variant="outline"
                    className="border-income/40 bg-income/10 text-income"
                >
                    <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
                    Imported
                </Badge>
            );
        case 'duplicate':
        case 'skipped':
            return (
                <Badge
                    variant="outline"
                    className="border-warning/40 bg-warning/10 text-warning"
                >
                    <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
                    {status === 'skipped' ? 'Skipped duplicate' : 'Duplicate'}
                </Badge>
            );
        case 'invalid':
        case 'failed':
            return (
                <Badge
                    variant="outline"
                    className="border-destructive/40 bg-destructive/10 text-destructive"
                >
                    <AlertCircle aria-hidden="true" className="mr-1 size-3" />
                    {status === 'failed' ? 'Failed' : 'Invalid'}
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="border-border">
                    {status}
                </Badge>
            );
    }
}

const workflowSteps = [
    { key: 'upload', label: '1. Upload file' },
    { key: 'map', label: '2. Map columns & preview' },
    { key: 'confirm', label: '3. Confirm & process' },
    { key: 'result', label: '4. Results' },
] as const;

export function getActiveWorkflowStep(
    status: string,
): (typeof workflowSteps)[number]['key'] {
    switch (status) {
        case 'uploaded':
            return 'map';
        case 'previewed':
            return 'confirm';
        case 'queued':
        case 'processing':
            return 'confirm';
        case 'completed':
        case 'completed_with_errors':
        case 'failed':
            return 'result';
        default:
            return 'upload';
    }
}

export function ImportWorkflowSteps({ status }: { status: string }) {
    const activeKey = getActiveWorkflowStep(status);
    const activeIndex = workflowSteps.findIndex(
        (step) => step.key === activeKey,
    );

    return (
        <nav
            aria-label="Import progress"
            className="rounded-lg border border-border bg-surface p-4"
        >
            <ol className="grid gap-3 sm:grid-cols-4">
                {workflowSteps.map((step, index) => {
                    const isDone = index < activeIndex;
                    const isCurrent = index === activeIndex;
                    return (
                        <li
                            key={step.key}
                            aria-current={isCurrent ? 'step' : undefined}
                            className={cn(
                                'flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium',
                                isCurrent
                                    ? 'border-primary bg-primary/10 text-foreground'
                                    : isDone
                                      ? 'bg-elevated/50 border-border text-foreground'
                                      : 'border-border/60 text-muted-foreground',
                            )}
                        >
                            {isDone ? (
                                <CheckCircle2
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0 text-income"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'size-2 shrink-0 rounded-full',
                                        isCurrent
                                            ? 'bg-primary'
                                            : 'bg-muted-foreground/40',
                                    )}
                                />
                            )}
                            <span>
                                {step.label}
                                {isDone ? (
                                    <span className="sr-only">
                                        {' '}
                                        (completed)
                                    </span>
                                ) : null}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
