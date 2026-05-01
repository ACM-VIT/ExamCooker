"use client";

import { useMergedBreadcrumbItems } from "@/app/components/common/nav-from-provider";
import { BreadcrumbOrderedList } from "@/app/components/common/top-breadcrumb-bar";
import type { BreadcrumbNavItem } from "@/lib/breadcrumb-nav";

type Crumb = { label: string; href?: string };

export default function VinCourseBreadcrumbs({ breadcrumbs }: { breadcrumbs: Crumb[] }) {
    const items: BreadcrumbNavItem[] = breadcrumbs.map((c) => ({
        label: c.label,
        href: c.href,
    }));
    const merged = useMergedBreadcrumbItems(items);

    return (
        <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center text-black dark:text-[#D5D5D5]"
        >
            <BreadcrumbOrderedList items={merged} leadingChevron />
        </nav>
    );
}
