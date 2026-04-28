import Link from "next/link";

type ThreadTag = {
    id: string;
    name: string;
};

const COURSE_TAG_REGEX = /\[([A-Z]{2,}\d{3,}[A-Z]?)\]$/;

const TagContainer = ({ tags }: { tags: ThreadTag[] | undefined }) => {
    return <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:gap-5 md:items-center">
        {tags?.map((tag) => (
            <div key={tag.id}>
                <Tag tagName={tag.name} />
            </div>
        ))}
    </div>;
};

export default TagContainer;

const Tag = ({ tagName }: { tagName: string }) => {
    const match = tagName.match(COURSE_TAG_REGEX);
    if (match) {
        return (
            <Link
                href={`/past_papers/${encodeURIComponent(match[1])}`}
                className="bg-white dark:bg-[#3F4451] text-xs md:text-xs px-0.5 md:p-1"
            >
                #{tagName}
            </Link>
        );
    }
    return (
        <span className="bg-white dark:bg-[#3F4451] text-xs md:text-xs px-0.5 md:p-1">
            #{tagName}
        </span>
    );
};
