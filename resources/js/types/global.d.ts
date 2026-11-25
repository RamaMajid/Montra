import type { Auth } from '@/types/auth';
import type { WorkspaceSummary } from '@/types/ui';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            workspaces: WorkspaceSummary[];
            activeWorkspace: WorkspaceSummary | null;
            sidebarOpen: boolean;
            invitation_url?: string | null;
            [key: string]: unknown;
        };
    }
}
