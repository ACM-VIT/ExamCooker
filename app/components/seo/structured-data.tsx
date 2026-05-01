import Script from "next/script";

type JsonLd = Record<string, unknown>;

function isJsonLdItem(item: JsonLd | null | undefined): item is JsonLd {
    return item != null && typeof item["@context"] === "string";
}

export default function StructuredData({
    data,
}: {
    data: JsonLd | JsonLd[] | Array<JsonLd | null | undefined> | null | undefined;
}) {
    let items: JsonLd[] = [];

    if (Array.isArray(data)) {
        for (const item of data) {
            if (isJsonLdItem(item)) {
                items.push(item);
            }
        }
    } else if (isJsonLdItem(data)) {
        items = [data];
    }

    if (items.length === 0) return null;

    return (
        <>
            {items.map((item, index) => {
                const baseKey = String(
                    item["@id"] ?? item.url ?? JSON.stringify(item),
                );
                const itemKey = `${baseKey}-${index}`;
                const scriptId = `jsonld-${baseKey
                    .replace(/[^a-zA-Z0-9_-]+/g, "-")
                    .slice(0, 72) || "item"}-${index}`;

                return (
                    <Script
                        key={itemKey}
                        id={scriptId}
                        type="application/ld+json"
                    >
                        {JSON.stringify(item)}
                    </Script>
                );
            })}
        </>
    );
}
