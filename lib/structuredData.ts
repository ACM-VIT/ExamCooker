import { absoluteUrl } from "@/lib/seo";

type JsonLdValue = Record<string, unknown>;

export type BreadcrumbInput = {
    name: string;
    path: string;
};

export type ItemListInput = {
    name: string;
    path: string;
};

export type FaqInput = {
    question: string;
    answer: string;
};

export function buildBreadcrumbList(items: BreadcrumbInput[]): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
        })),
    };
}

export function buildItemList(items: ItemListInput[]): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            url: absoluteUrl(item.path),
        })),
    };
}

export function buildFaqPage(entries: FaqInput[]): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: entry.answer,
            },
        })),
    };
}

export function buildCollectionPage(input: {
    name: string;
    description: string;
    path: string;
    keywords?: string[];
    about?: string;
}): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: input.name,
        description: input.description,
        url: absoluteUrl(input.path),
        keywords: input.keywords?.join(", "),
        about: input.about
            ? {
                  "@type": "Thing",
                  name: input.about,
              }
            : undefined,
        isPartOf: {
            "@type": "WebSite",
            name: "ExamCooker",
            url: absoluteUrl("/"),
        },
    };
}

export function buildCourseStructuredData(input: {
    code: string;
    title: string;
    description: string;
    path: string;
}): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "Course",
        name: input.title,
        courseCode: input.code,
        description: input.description,
        url: absoluteUrl(input.path),
        provider: {
            "@type": "Organization",
            name: "ExamCooker",
            parentOrganization: {
                "@type": "Organization",
                name: "ACM-VIT",
            },
        },
    };
}

export function buildWebSiteStructuredData(): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ExamCooker",
        url: absoluteUrl("/"),
        potentialAction: {
            "@type": "SearchAction",
            target: absoluteUrl("/past_papers?search={search_term_string}"),
            "query-input": "required name=search_term_string",
        },
    };
}

export function buildOrganizationStructuredData(): JsonLdValue {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "ExamCooker",
        url: absoluteUrl("/"),
        parentOrganization: {
            "@type": "Organization",
            name: "ACM-VIT",
        },
    };
}
