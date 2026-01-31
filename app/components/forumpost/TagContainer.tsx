import Link from "next/link";
import type { Tag } from "@/src/generated/prisma";
import { extractCourseFromTag } from "@/lib/courseTags";

const TagContainer = ({tags}:{tags:Tag[]|undefined}) => {
    return <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:gap-5 md:items-center">
        {tags?.map((tag) => {
            return (<div key={tag.id}>
                <Tag tagName={tag.name} />
                </div>
            );
        })}
    </div>
}

export default TagContainer;

const Tag = ({ tagName }: { tagName: string }) => {
    const course = extractCourseFromTag(tagName);
    if (course) {
        return (
            <Link
                href={`/courses/${encodeURIComponent(course.code)}`}
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
}
