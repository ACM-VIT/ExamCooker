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
    return (
        <nav
            aria-label="Breadcrumb"
            className={`flex min-w-0 flex-wrap items-center text-black dark:text-[#D5D5D5] ${className ?? ""}`}
        >
            <BreadcrumbOrderedList items={items} leadingChevron={leadingChevron} />
        </nav>
    );
}
