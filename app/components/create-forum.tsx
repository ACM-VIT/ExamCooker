"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createForumPost } from '../actions/CreateForumPost';
import { useRouter } from 'next/navigation';

const CreateForum: React.FC = () => {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [subject, setSubject] = useState('');
  const [slot, setSlot] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const authorId = "cly0klo9800006hg6gwc73j5u";
  const forumId = "cly4bhnc0000df02z5tshuhx7";

  const router = useRouter();

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        router.push('/forum');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createForumPost({ title, authorId, forumId });
    if (result.success) {
      console.log('New forum post created: ', result.data);
      setIsSuccess(true);
    } else {
      console.error("Error: ", result.error);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-white p-6 shadow-lg">
          <p className="text-green-600 font-bold text-xl">Forum post successfully created!</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <Link href={'/forum'}>
            <button className="text-[#3BF3C7] px-2 py-1 border-2 border-[#3BF3C7] flex items-center justify-center font-bold hover:bg-teal-600">
              <span className="mr-0">&larr;</span>
            </button>
          </Link>
          <button
            className="bg-teal-400 hover:bg-teal-500 text-black px-4 py-2 border-2 border-black font-bold"
            onClick={handleSubmit}
          >
            Post
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Title"
              className={`p-2 border ${title ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-lg font-bold`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <input
                type="text"
                placeholder="Year"
                className={`p-2 border ${year ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-base font-bold`}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Subject"
                className={`p-2 border ${subject ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-base font-bold`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div>
              <select
                className="p-2 w-2/3 text-black bg-blue-400 cursor-pointer transition-colors duration-300 hover:bg-blue-600"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                required
              >
                <option value="">Slot</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
                <option value="D1">D1</option>
                <option value="D2">D2</option>
                <option value="E1">E1</option>
                <option value="E2">E2</option>
                <option value="F1">F1</option>
                <option value="F2">F2</option>
                <option value="G1">G1</option>
                <option value="G2">G2</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <textarea
              placeholder="Thread Description"
              className={`p-2 border ${description ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-sm min-h-[150px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center mb-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block text-gray-700 px-3 py-1 text-sm font-semibold mr-2 mb-2"
                >
                  #{tag}{' '}
                  <button
                    type="button"
                    //onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-red-500"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {isAddingTag ? (
                <input
                  type="text"
                  autoFocus
                  className={`p-2 border ${newTag ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-lg font-bold`}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  //onKeyDown={handleKeyDown}
                />
              ) : (
                <button
                  type="button"
                  //onClick={handleAddTagClick}
                  className="bg-white hover:bg-blue-300 text-[#3BF3C7] px-4 py-2 border-2 border-[#3BF3C7] font-bold text-sm cursor-pointer ml-2"
                >
                  Add tag
                </button>
              )}
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateForum;
