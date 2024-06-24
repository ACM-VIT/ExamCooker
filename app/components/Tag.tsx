export default function Tag({tagName}:{tagName:string}){
    tagName = tagName==="" ? "yay" : tagName;

    return <text className="bg-white text-gray-500 text-xs p-1">#{tagName}</text>;
}
