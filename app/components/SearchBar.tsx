'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from "next/image";
import debounce from 'lodash/debounce';
import Seacrh from "@/app/components/assets/seacrh.svg";

interface SearchProps {
    pageType:
        | 'syllabus'
        | 'notes'
        | 'past_papers'
        | 'resources'
        | 'forum'
        | 'favourites'
        | 'courses';
    availableTags?: string[];
    initialQuery?: string;
}

export default function Search({ pageType, availableTags, initialQuery = '' }: SearchProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(initialQuery || searchParams.get('search') || '');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        const tags = searchParams.getAll('tags');
        if (tags.length > 0) {
            setSelectedTags(tags);
        }
    }, [searchParams]);

    const updateURL = useCallback((newQuery: string, newTags: string[]) => {
        const params = new URLSearchParams(searchParams);
        params.set('search', newQuery);
        params.delete('tags');
        newTags.forEach(tag => params.append('tags', tag));
        const newURL = `/${pageType}?${params.toString()}`;
        router.push(newURL);
    }, [pageType, router, searchParams]);

    const debouncedSearch = useMemo(
        () => debounce((newQuery: string, newTags: string[]) => updateURL(newQuery, newTags), 300),
        [updateURL]
    );

    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, [debouncedSearch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        debouncedSearch(newQuery, selectedTags);
    };

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => {
            const newTags = prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag];
            updateURL(query, newTags);
            return newTags;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateURL(query, selectedTags);
    };

    return (
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
            <div className="relative flex items-center bg-white dark:bg-[#3D414E] border border-black dark:border-[#D5D5D5] w-full px-2 py-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                <Image src={Seacrh} alt="search" className="dark:invert-[.835]" />
                <input
                    type="text"
                    className="px-4 py-2 w-full focus:outline-none bg-white dark:bg-[#3D414E]"
                    placeholder="Search"
                    value={query}
                    onChange={handleChange}
                />
                <button type="submit" className="hidden">Search</button>
            </div>
            {availableTags && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {availableTags.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagToggle(tag)}
                            className={`px-3 py-1 rounded-full text-sm ${selectedTags.includes(tag)
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}
        </form>
    );
}
