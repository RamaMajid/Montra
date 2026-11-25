import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
};

/** Nav item that may point at a page shipped in a later frontend phase. */
export type NavGroupItem = Omit<NavItem, 'href'> & {
    href?: NonNullable<InertiaLinkProps['href']>;
    disabled?: boolean;
    hint?: string;
};

export type NavGroup = {
    label: string;
    items: NavGroupItem[];
};
