"use client";

import React from 'react';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { Note } from '@prisma/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PastPaperCardProps {
  title: string;
  imageSrc: string;
}

function PastPaperCard({ note }: {note: Note}) {
  const [isFav, setIsFav] = useState(false);
  const router = useRouter();

  function FavpeCLick() {
    setIsFav(!isFav);
  }

  return (
    <div className="w-[95%]">
      <div className="p-4 w-full text-center bg-[#5fc4e7]" >
        <div className="bg-[#d9d9d9] w-full h-36 mb-4 overflow-hidden">
          <img src="https://topperworld.in/media/2022/11/c-sc.png" alt={note.title} className="w-full h-full object-cover" />
        </div>
        <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {note.title}
        </div>
        <div className="flex justify-around items-center space-x-4">
        <button className="py-[2.605%] px-0 md:px-2 text-sm flex items-center bg-white text-black">
          <Link className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black" href={`past_papers/${note.id}`}>
            <span className="mr-1 flex items-center justify-center">
              <FontAwesomeIcon icon={faEye} />
            </span>
            View Paper
          </Link>
        </button>
          <button className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
            More
            <span className="ml-2 flex items-center justify-center">
              <FontAwesomeIcon icon={faCaretDown} style={{ fontSize: '1.25rem' }} />
            </span>
          </button>
          <button onClick={FavpeCLick} style={{ color: isFav ? 'red' : 'lightgrey' }}>
            <FontAwesomeIcon icon={faHeart} />

          </button>
        </div>
      </div>
    </div>
  )
};
export default PastPaperCard;
