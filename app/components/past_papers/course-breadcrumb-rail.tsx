"use client";

import TopBreadcrumbBar from "@/app/components/common/top-breadcrumb-bar";
import { useMergedBreadcrumbItems } from "@/app/components/common/nav-from-provider";
import type { BreadcrumbNavItem } from "@/lib/breadcrumb-nav";

type Props = {
    items: BreadcrumbNavItem[];
    className?: string;
};

export default function CourseBreadcrumbRail({ items, className }: Props) {
    const merged = useMergedBreadcrumbItems(items);

    return <TopBreadcrumbBar items={merged} className={className} />;
}
