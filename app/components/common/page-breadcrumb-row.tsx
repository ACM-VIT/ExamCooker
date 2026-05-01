"use client";

import { useMergedBreadcrumbItems } from "@/app/components/common/nav-from-provider";
import { BreadcrumbOrderedList } from "@/app/components/common/top-breadcrumb-bar";
import type { BreadcrumbNavItem } from "@/lib/breadcrumb-nav";

type Props = {
    items: BreadcrumbNavItem[];
    className?: string;
    leadingChevron?: boolean;
};

export default function PageBreadcrumbRow({
    items,
    className,
    leadingChevron = true,
}: Props) {
    const merged = useMergedBreadcrumbItems(items);

    return (
        <nav
            aria-label="Breadcrumb"
            className={`flex min-w-0 flex-wrap items-center text-black dark:text-[#D5D5D5] ${className ?? ""}`}
        >
            <BreadcrumbOrderedList items={merged} leadingChevron={leadingChevron} />
        </nav>
    );
}
