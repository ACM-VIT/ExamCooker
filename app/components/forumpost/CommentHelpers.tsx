export function formatRelativeTime(value: Date | string) {
    const date = typeof value === "string" ? new Date(value) : value;
    const diffMs = Date.now() - date.getTime();

    if (diffMs < 0) {
        return "in the future";
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function NumberOfComments({
    commentArray,
    count,
}: {
    commentArray?: ReadonlyArray<unknown>;
    count?: number;
}) {
    const total = typeof count === "number" ? count : commentArray?.length ?? 0;
    return (
        <div>
            <span className="bg-none px-2 py-4 text-base">{total} Comments</span>
        </div>
    );
}
