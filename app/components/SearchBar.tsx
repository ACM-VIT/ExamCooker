"use client";
import React, { useState } from "react";
import Seacrh from "@/app/components/assets/seacrh.svg";
import Image from "next/image";

const SearchBar: React.FC = () => {
    const [query, setQuery] = useState<string>("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    return (
        <div className="relative flex items-center w-[950px]">
            <div className="absolute inset-0 bg-black translate-x-2 translate-y-2  pointer-events-none"></div>
            <div className="relative flex items-center bg-white border border-black w-full px-4 ">
                <Image src={Seacrh} alt="seacrh" className="" />
                {/* <FontAwesomeIcon
                    icon={faSearch}
                    color="grey"
                    className="ml-4"
                /> */}
                <input
                    type="text"
                    className="px-4 py-2 w-full rounded-l-full focus:outline-none"
                    placeholder="Search"
                    value={query}
                    onChange={handleInputChange}
                />
            </div>
        </div>
    );
};

export default SearchBar;
