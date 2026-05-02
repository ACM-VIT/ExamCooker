import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { BreadcrumbNavItem } from "@/lib/breadcrumb-nav";

const linkClass =
    "shrink-0 text-sm font-medium text-black/55 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#D5D5D5]";
const mutedClass = "text-sm font-medium text-black/55 dark:text-[#D5D5D5]/70";
const currentClass = "text-sm font-semibold text-black dark:text-[#D5D5D5]";
const compactLinkClass =
    "shrink-0 text-xs font-semibold text-black/55 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#D5D5D5]";
const compactMutedClass = "text-xs font-semibold text-black/45 dark:text-[#D5D5D5]/55";
const compactCurrentClass = "text-xs font-semibold text-black/75 dark:text-[#D5D5D5]/85";

type Props = {
    items: BreadcrumbNavItem[];
    className?: string;
    variant?: "fixed" | "inline";
};

export function BreadcrumbOrderedList({
    items,
    leadingChevron = false,
}: {
    items: BreadcrumbNavItem[];
    /** First link shows a back chevron (PDF / detail views) */
    leadingChevron?: boolean;
}) {
    const compactItems =
        leadingChevron ? items.slice(0, 1)
        : items.length > 2 ? [items[0], items[items.length - 1]]
        : items;

    const renderItems = (sourceItems: BreadcrumbNavItem[], compact: boolean) =>
        sourceItems.map((item, index) => {
            const isLast = index === sourceItems.length - 1;
            const showAsLink = Boolean(item.href);
            const itemKey = item.href ?? `${item.label}-${isLast ? "current" : "crumb"}`;
            const itemLinkClass = compact ? compactLinkClass : linkClass;
            const itemMutedClass = compact ? compactMutedClass : mutedClass;
            const itemCurrentClass = compact ? compactCurrentClass : currentClass;
            const labelClass =
                compact ?
                    "min-w-0 max-w-[min(46vw,12rem)] truncate"
                :   "min-w-0 truncate";

            return (
                <li key={itemKey} className="flex min-w-0 items-center gap-1.5">
                    {showAsLink ? (
                        <Link
                            href={item.href!}
                            transitionTypes={["nav-back"]}
                            aria-label={
                                leadingChevron && index === 0 ?
                                    `Back to ${item.label}`
                                :   undefined
                            }
                            className={`${itemLinkClass} inline-flex max-w-full min-w-0 items-center gap-1 ${
                                leadingChevron && index === 0 ? "group" : ""
                            }`}
                        >
                            {leadingChevron && index === 0 ?
                                <ChevronLeft
                                    className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 transition-transform group-hover:-translate-x-0.5`}
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            : null}
                            {leadingChevron && index === 0 ?
                                <>
                                    <span className="hidden lg:inline">Back to </span>
                                    <span className={labelClass}>{item.label}</span>
                                </>
                            :   <span className={labelClass}>{item.label}</span>}
                        </Link>
                    ) : (
                        <span
                            className={`${labelClass} ${
                                isLast ? itemCurrentClass : itemMutedClass
                            }`}
                        >
                            {item.label}
                        </span>
                    )}

                    {!isLast && (
                        <span
                            aria-hidden="true"
                            className={`${compact ? "text-xs" : "text-sm"} shrink-0 font-medium text-black/30 dark:text-[#D5D5D5]/35`}
                        >
                            ›
                        </span>
                    )}
                </li>
            );
        });

    return (
        <>
            <ol className="flex min-w-0 items-center gap-1 overflow-hidden sm:hidden">
                {renderItems(compactItems, true)}
            </ol>
            <ol className="hidden min-w-0 items-center gap-1.5 overflow-hidden sm:flex">
                {renderItems(items, false)}
            </ol>
        </>
    );
}

export default function TopBreadcrumbBar({ items, className, variant = "fixed" }: Props) {
    const navClass =
        variant === "fixed" ?
            `ec-mobile-breadcrumb-chrome fixed left-[max(0.75rem,env(safe-area-inset-left))] right-[calc(max(0.75rem,env(safe-area-inset-right))+3.25rem)] top-[env(safe-area-inset-top)] z-[59] flex h-11 min-w-0 items-center px-3 lg:static lg:h-auto lg:px-0 ${className ?? ""}`
        : `flex min-w-0 items-center ${className ?? ""}`;

    return (
        <nav aria-label="Breadcrumb" className={navClass}>
            <BreadcrumbOrderedList items={items} />
        </nav>
    );
}
