"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { createForumPost } from '../actions/CreateForumPost';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { getTags } from '../actions/fetchTags';

const CreateForum: React.FC = () => {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [slot, setSlot] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const authorId = "cly0klo9800006hg6gwc73j5u";
  const forumId = "cly4bhnc0000df02z5tshuhx7";

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const years = ['2020', '2021', '2022', '2023', '2024'];
  const slots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2'];

  const filterYearAndSlot = (tags: string[], years: string[], slots: string[]) => {
    const yearRegex = /^(2\d{3}|3000)$/;
    return tags.filter(tag => !yearRegex.test(tag) && !slots.includes(tag));
  };

  useEffect(() => {
    async function fetchTags() {
      try {
        const fetchedTags = await getTags();
        const filteredTags = filterYearAndSlot(fetchedTags, years, slots);
        setAvailableTags(filteredTags);
        setFilteredTags(filteredTags);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    }
    fetchTags();
  }, []);

  const fuse = useMemo(() => new Fuse(availableTags, {
    threshold: 0.6,
    minMatchCharLength: 2,
  }), [availableTags]);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        router.push('/forum');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createForumPost({ title, authorId, forumId, description, year, slot, selectedTags });
    if (result.success) {
      console.log('New forum post created: ', result.data);
      setIsSuccess(true);
    } else {
      console.error("Error: ", result.error);
    }
  };

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewTag(value);
    setShowDropdown(true);
    if (value) {
      const results = fuse.search(value);
      const filteredResults = filterYearAndSlot(results.map(result => result.item), years, slots);
      setFilteredTags(filteredResults);
    } else {
      setFilteredTags(filterYearAndSlot(availableTags, years, slots));
    }
  };

  const handleTagSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setNewTag('');
    setIsAddingTag(false);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newTag && !selectedTags.includes(newTag)) {
        setSelectedTags([...selectedTags, newTag]);
        if (!availableTags.includes(newTag)) {
          setAvailableTags([...availableTags, newTag]);
        }
        setNewTag('');
        setIsAddingTag(false);
        setShowDropdown(false);
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
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
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <select
                className="p-2 w-full text-black bg-blue-400 cursor-pointer transition-colors duration-300 hover:bg-blue-600"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              >
                <option value="">Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="p-2 w-full text-black bg-blue-400 cursor-pointer transition-colors duration-300 hover:bg-blue-600"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                required
              >
                <option value="">Slot</option>
                {slots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block text-gray-700 px-3 py-1 text-sm font-semibold mr-2 mb-2"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-red-500"
                  >
                    &times;
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Add tag"
                  className={`p-2 border ${newTag ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-lg font-bold`}
                  value={newTag}
                  onChange={handleTagInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                />
                {showDropdown && (
                  <div ref={dropdownRef} className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {filteredTags.map((tag) => (
                      <div
                        key={tag}
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
                        onClick={() => handleTagSelect(tag)}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

};

export default CreateForum;
