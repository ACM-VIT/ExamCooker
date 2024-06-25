const TagContainer = ({tags}:{tags:any[]}) => {
    return <div className="flex gap-1 md:gap-5 items-center">
        {tags.map((tag) => {
            return (
                <Tag key={tag.id} tagName={tag.name} />
            );
        })}
    </div>
}

export default TagContainer;

const Tag = ({ tagName }: { tagName: string }) => {
    return <text className="bg-white text-gray-500 flex text-xs md:text-xs px-0.5 md:p-1">#{tagName}</text>;
}
