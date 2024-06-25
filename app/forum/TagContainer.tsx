//dummy data created using gemini with respect to current schema
const jsonData = JSON.parse(`{
  "tags": [
    {
      "id": "t1",
      "name": "javascript",
      "notes": [],  
      "forums": [],  
      "forumPosts": [],  
      "pastPapers": [],  
      "createdAt": "2024-06-26T12:00:00.000Z",
      "updatedAt": "2024-06-26T12:00:00.000Z"
    },
    {
      "id": "t2",
      "name": "python",
      "notes": [],  
      "forums": [],  
      "forumPosts": [],  
      "pastPapers": [],  
      "createdAt": "2024-06-26T12:01:00.000Z",
      "updatedAt": "2024-06-26T12:01:00.000Z"
    },
    {
      "id": "t3",
      "name": "machine learning",
      "notes": [],  
      "forums": [],  
      "forumPosts": [],  
      "pastPapers": [],  
      "createdAt": "2024-06-26T12:02:00.000Z",
      "updatedAt": "2024-06-26T12:02:00.000Z"
    }
  ]
}`);

const tags: any[] = jsonData.tags;

const TagContainer = () => {
    return <div className="flex gap-5 items-center">
        {tags.map((tag) => {
            return (
                <Tag key={tag.id} tagName={tag.name} />
            );
        })}
    </div>
}

export default TagContainer;

const Tag = ({ tagName }: { tagName: string }) => {
    return <text className="bg-white text-gray-500 flex text-xs p-1">#{tagName}</text>;
}
