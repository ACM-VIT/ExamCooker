import Link from "next/link";

type BreadcrumbItem = {
    label: string;
    href?: string;
};

type Props = {
    items: BreadcrumbItem[];
    className?: string;
};

export default function TopBreadcrumbBar({ items, className }: Props) {
    return (
        <nav
            aria-label="Breadcrumb"
            className={`fixed left-16 right-3 top-3 z-[55] flex h-10 min-w-0 items-center rounded-lg border border-black/10 bg-white/90 px-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]/90 lg:static lg:h-auto lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none lg:backdrop-blur-none lg:dark:bg-transparent ${className ?? ""}`}
        >
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    const itemKey = item.href ?? `${item.label}-${isLast ? "current" : "crumb"}`;

                    return (
                        <li key={itemKey} className="flex min-w-0 items-center gap-1.5">
                            {item.href && !isLast ? (
                                <Link
                                    href={item.href}
                                    transitionTypes={["nav-back"]}
                                    className="shrink-0 text-black/55 transition-colors hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span
                                    className={`min-w-0 truncate ${
                                        isLast
                                            ? "font-semibold text-black dark:text-[#D5D5D5]"
                                            : "text-black/55 dark:text-[#D5D5D5]/55"
                                    }`}
                                >
                                    {item.label}
                                </span>
                            )}

                            {!isLast && (
                                <span
                                    aria-hidden="true"
                                    className="shrink-0 text-black/30 dark:text-[#D5D5D5]/30"
                                >
                                    ›
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
