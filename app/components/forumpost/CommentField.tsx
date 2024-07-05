"use client";

import Image from "next/image";
import { useState } from "react";
import { createComment } from "@/app/actions/CreateComment";

interface AddCommentFormProps {
  forumPostId: string;
  onCommentAdded?: () => void;
}

const CommentField: React.FC<AddCommentFormProps> = ({ forumPostId, onCommentAdded }) => {
  const [content, setContent] = useState('');
  const authorId = 'cly0klo9800006hg6gwc73j5u'; // This should ideally come from user authentication

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!content.trim()) {
      alert("Comment cannot be empty");
      return;
    }

    console.log('Sending comment data:', { content, authorId, forumPostId });
    const result = await createComment({
        content,
        authorId,
        forumPostId
    });

    if (result.success) {
        console.log('New comment created:', result.data);
        setContent('');
        if (onCommentAdded) {
          onCommentAdded();
        }
      } else {
        console.error('Error creating comment:', result.error);
        alert(`Failed to add comment: ${result.error}`);
      }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setContent(event.target.value);
  };

  return (
    <div>
      <form className="relative drop-shadow-md flex align-top mb-5" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Add a comment.." 
          value={content} 
          className="w-full px-4 py-3 text-base placeholder-[#838383] focus:outline-none focus:ring-2 focus:ring-[#3BF3C7]" 
          onChange={handleInputChange} 
        />
        <SubmitCommentButton />
      </form>
    </div>
  );
};

export default CommentField;

const SubmitCommentButton: React.FC = () => {
  return (
    <button type="submit" className="bg-white py-3 px-4 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3BF3C7]">
      <Image
        src="/comment/SubmitComment.svg"
        alt="Submit Comment"
        width={24}
        height={24}
      />
    </button>
  );
};