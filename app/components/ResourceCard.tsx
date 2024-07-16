"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Subject } from '@prisma/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { useFavoritesStore } from '../actions/StoredFavourites';

interface ResourceCardProps {
    subject: Subject;
}

function ResourceCard({ subject }: ResourceCardProps) {
    const { toggleFavorite, isFavorite } = useFavoritesStore();

    const handleToggleFav = () => {
        toggleFavorite({ id: subject.id, type: 'subject' });
    };


    // Since the Subject datatype only has a "name" field, I assume that the name has to be something like "COURSECODE - COURSENAME" and 
    // am hence, using the '-' character to split the string
    let [courseCode, courseName] = subject.name.split('-');
    courseName = courseName ? courseName : "Subject Name";

    return (
        <div className="flex flex-col justify-between w-full h-full p-4 bg-[#5FC4E7] border-b-2 border-b-[#5FC4E7] dark:border-b-[#3D414E] hover:border-b-2 hover:border-b-[#ffffff]  dark:hover:border-b-[#3BF4C7] dark:bg-[#0C1222] dark:hover:bg-[#ffffff]/10 transition-all duration-200 transform hover:scale-105 hover:shadow-lg">
            <div className='items-start'>
                <Link href={`/resources/${subject.id}`} className="block w-full text-left">
                    <p>RESOURCES</p>
                    <h4>{courseName.trim()}</h4>
                    <h6>Course Code: {courseCode.trim()}</h6>
                </Link>
            </div>
            <div className='items-end'>
                <div className='flex justify-between'>
                    <div />
                    <button onClick={handleToggleFav} className="ml-4" style={{ color: isFavorite(subject.id, 'subject') ? 'red' : 'lightgrey' }}>
                        <FontAwesomeIcon icon={faHeart} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ResourceCard;
