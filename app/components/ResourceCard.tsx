"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Subject } from '@prisma/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';

interface ResourceCardProps {
    subject: Subject;
}

function ResourceCard({ subject }: ResourceCardProps) {
    const [isFav, setIsFav] = useState(false);

    const toggleFavorite = () => {
        setIsFav(!isFav);
    };

    return (
        <div className="max-w-sm w-full">
            <div className="flex items-center justify-between p-4 bg-blue-500 hover:bg-blue-400 transition-colors duration-200">
                <Link href={`/resources/${subject.id}`} className="block w-full text-left">
                    <h2 className="text-xl font-bold text-white">{subject.name}</h2>
                </Link>
                <button onClick={toggleFavorite} className="ml-4" style={{ color: isFav ? 'red' : 'lightgrey' }}>
                    <FontAwesomeIcon icon={faHeart} />
                </button>
            </div>
        </div>
    );
}

export default ResourceCard;
