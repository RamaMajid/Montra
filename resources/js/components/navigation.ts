import {
    ArrowLeftRight,
    BarChart3,
    CreditCard,
    FileChartColumn,
    FolderTree,
    Gauge,
    Landmark,
    Lightbulb,
    PiggyBank,
    Settings,
    Upload,
} from 'lucide-react';
import type { NavGroup } from '@/types';

export const navigationGroups: NavGroup[] = [
    {
        label: 'Overview',
        items: [{ title: 'Dashboard', href: '/dashboard', icon: Gauge }],
    },
    {
        label: 'Financial management',
        items: [
            {
                title: 'Transactions',
                href: '/transactions',
                icon: ArrowLeftRight,
            },
            { title: 'Import transactions', href: '/imports', icon: Upload },
            { title: 'Accounts', href: '/accounts', icon: CreditCard },
            { title: 'Categories', href: '/categories', icon: FolderTree },
            { title: 'Budgets', href: '/budgets', icon: Landmark },
        ],
    },
    {
        label: 'Financial planning',
        items: [
            {
                title: 'Savings goals',
                icon: PiggyBank,
                disabled: true,
                hint: 'Frontend Phase 7',
            },
        ],
    },
    {
        label: 'Insights & reports',
        items: [
            {
                title: 'Analytics',
                icon: BarChart3,
                disabled: true,
                hint: 'Frontend Phase 6',
            },
            {
                title: 'Financial intelligence',
                icon: Lightbulb,
                disabled: true,
                hint: 'Frontend Phase 7',
            },
            {
                title: 'Reports',
                icon: FileChartColumn,
                disabled: true,
                hint: 'Frontend Phase 8',
            },
        ],
    },
    {
        label: 'Workspace & settings',
        items: [
            { title: 'Workspace', href: '/workspaces', icon: Landmark },
            { title: 'Settings', href: '/settings/profile', icon: Settings },
        ],
    },
];
