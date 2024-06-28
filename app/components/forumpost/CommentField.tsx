"use client";
import Image from "next/image";
import { useState } from "react";


export default function CommentField() {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        alert(text);// have to change this later to make the text appear as a comment
        setText("");
    };

    const [text, setText] = useState('');

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setText(event.target.value);
    };

    return (
        <div >
            <form className="relative drop-shadow-md flex align-top mb-5" onSubmit={handleSubmit}>
                <input type="text" placeholder="Add a comment.." value={text} className="w-full px-4 py-3 text-base placeholder-[#838383] focus:border-[#3BF3C7]" onChange={handleInputChange} />
                <SubmitCommentButton />
            </form>
        </div>

    );
}

export function SubmitCommentButton() {
    return <button type="submit" className="bg-white py-3 px-4 hover:bg-gray-300">
        <Image
            src={"/comment/SubmitComment.svg"}
            alt="Submit Comment"
            width={24}
            height={24}
        />
    </button>;
}
