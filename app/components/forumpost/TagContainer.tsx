import type { Tag } from "@prisma/client";

const TagContainer = ({tags}:{tags:Tag[]}) => {
    return <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:gap-5 md:items-center">
        {tags.map((tag) => {
            return (<div key={tag.id}>
                <Tag tagName={tag.name} />
                </div>
            );
        })}
    </div>
}

export default TagContainer;

const Tag = ({ tagName }: { tagName: string }) => {
    return <text className="bg-white text-gray-500 text-xs md:text-xs px-0.5 md:p-1">#{tagName}</text>;
}
