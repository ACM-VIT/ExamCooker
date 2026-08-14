import TopBreadcrumbBar from "@/app/components/common/top-breadcrumb-bar";
import type { BreadcrumbNavItem } from "@/lib/breadcrumb-nav";

type Props = {
    items: BreadcrumbNavItem[];
    className?: string;
};

export default function CourseBreadcrumbRail({ items, className }: Props) {
    return <TopBreadcrumbBar items={items} className={className} variant="inline" />;
}
