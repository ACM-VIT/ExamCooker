
"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import Seacrh from "@/app/components/assets/seacrh.svg";

interface SearchBarProps {
    pageType: 'notes' | 'past_papers' | 'resources' | 'forum';
}

const SearchBar: React.FC<SearchBarProps> = ({ pageType }) => {
    const [query, setQuery] = useState<string>("");
    const router = useRouter();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        router.push(`/${pageType}?search=${encodeURIComponent(query)}`);
    };

    return (
        <form onSubmit={handleSearch} className="relative flex items-center w-2/3">
            <div className="relative flex items-center bg-white border border-black w-full px-2 py-0.5 shadow-[5px_5px_0_0_rgba(0,0,0,1)]">
                <Image src={Seacrh} alt="search" className="" />
                <input
                    type="text"
                    className="px-4 py-2 w-full rounded-l-full focus:outline-none"
                    placeholder="Search"
                    value={query}
                    onChange={handleInputChange}
                />
                <button type="submit" className="hidden">Search</button>
            </div>
        </form>
    );
};

export default SearchBar;
