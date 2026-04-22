'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from "@/app/components/common/AppImage";
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
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlQuery = searchParams.get('search') || '';
    const [query, setQuery] = useState(initialQuery || urlQuery);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        const tags = searchParams.getAll('tags');
        setSelectedTags(tags);
    }, [searchParams]);

    useEffect(() => {
        const nextQuery = initialQuery || urlQuery;
        setQuery((currentQuery) => currentQuery === nextQuery ? currentQuery : nextQuery);
    }, [initialQuery, urlQuery]);

    const updateURL = useCallback((newQuery: string, newTags: string[]) => {
        const params = new URLSearchParams(searchParams.toString());
        const normalizedQuery = newQuery.trim();

        if (normalizedQuery) {
            params.set('search', normalizedQuery);
        } else {
            params.delete('search');
        }

        params.delete('page');
        params.delete('tags');
        newTags.forEach(tag => params.append('tags', tag));
        const nextQueryString = params.toString();
        const nextPath = pathname || `/${pageType}`;
        const newURL = nextQueryString ? `${nextPath}?${nextQueryString}` : nextPath;
        router.replace(newURL, { scroll: false });
    }, [pageType, pathname, router, searchParams]);

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
        debouncedSearch.cancel();
        updateURL(query, selectedTags);
    };

    return (
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
            <div className="relative flex items-center bg-white dark:bg-[#3D414E] border border-black dark:border-[#D5D5D5] w-full px-2 py-0.5 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                <Image src={Seacrh} alt="search" className="dark:invert-[.835]" />
                <input
                    type="text"
                    className="px-4 py-2 w-full focus:outline-none bg-white dark:bg-[#3D414E] text-black dark:text-[#D5D5D5] placeholder:text-black/50 dark:placeholder:text-[#D5D5D5]/60"
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
