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
            {items.map((item, index) => (
                <script
                    key={`${String(item["@type"] ?? "jsonld")}-${index}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(item),
                    }}
                />
            ))}
        </>
    );
}
