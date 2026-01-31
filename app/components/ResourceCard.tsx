"use client";
import React from 'react';
import Link from 'next/link';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHeart} from '@fortawesome/free-solid-svg-icons';
import {useBookmarks} from './BookmarksProvider';
import {useToast} from "@/components/ui/use-toast";

interface ResourceCardProps {
    subject: {
        id: string;
        name: string;
    };
}

function ResourceCard({subject}: ResourceCardProps) {
    const {isBookmarked, toggleBookmark} = useBookmarks();
    const isFav = isBookmarked(subject.id, 'subject');
    const {toast} = useToast();

    const handleToggleFav = () => {
        toggleBookmark({
            id: subject.id,
            type: 'subject',
            title: subject.name
        }, !isFav).catch(() => toast({title: "Error! Could not add to favorites", variant: "destructive"}));
    };


    // Since the Subject datatype only has a "name" field, I assume that the name has to be something like "COURSECODE - COURSENAME" and 
    // am hence, using the '-' character to split the string
    let [courseCode, courseName] = subject.name.split('-');
    // courseName = courseName ? courseName : "Subject Name";

    return (
        <div
            className="flex flex-col justify-between w-full h-full p-4 bg-[#5FC4E7] border-2 border-[#5FC4E7]  dark:border-b-[#3BF4C7] dark:lg:border-b-[#ffffff]/20 dark:border-[#ffffff]/20 hover:border-b-2 hover:border-b-[#ffffff]  dark:hover:border-b-[#3BF4C7] dark:bg-[#ffffff]/10 dark:lg:bg-[#0C1222] dark:hover:bg-[#ffffff]/10 transition-all duration-200 transform hover:scale-105 hover:shadow-lg">
            <div className='items-start'>
                <Link href={`/resources/${subject.id}`} className="block w-full text-left">
                    <h4>{courseName.trim()}</h4>
                    <h6>{courseCode.trim()}</h6>
                </Link>
            </div>
            <div className='items-end'>
                <div className='flex justify-between'>
                    <div/>
                    <button onClick={handleToggleFav} className="ml-4" style={{color: isFav ? 'red' : 'lightgrey'}}>
                        <FontAwesomeIcon icon={faHeart}/>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ResourceCard;
