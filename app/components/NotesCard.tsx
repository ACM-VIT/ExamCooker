///All of the following code is dummy, boilerplate. Replace with relevant material.

// components/NotesCard.tsx
/*import React from 'react'

interface NotesCardProps {
  imageSrc: string
  title: string
  content?: string  // Make content optional if it might not always be present
}

const NotesCard: React.FC<NotesCardProps> = ({ imageSrc, title, content }) => {
  return (
    <div className="border-2 border-blue-500 p-4 shadow-lg">
      <div className="border-4 border-blue-500 rounded-lg overflow-hidden mb-4">
        <img src={imageSrc} alt={title} className="w-full h-48 object-cover" />
      </div>
      <h2 className="text-xl font-bold text-blue-500">{title}</h2>
      {content && <p className="mt-2 text-gray-700">{content}</p>}
    </div>
  )
}

export default NotesCard
*/

"use client";

import React from 'react';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-solid-svg-icons';

interface NotesCardProps {
  title: string;
  imageSrc: string;
}

const NotesCard: React.FC<NotesCardProps> = ({ imageSrc, title }) => {
  const [isFav, setIsFav] = useState(false);

  function FavpeCLick() {
    setIsFav(!isFav);
  }


  
  return (
    <div className="w-[95%]">
      <div className="p-4 w-full text-center bg-[#5fc4e7]" >
        <div className="bg-[#d9d9d9] w-full h-36 mb-4 overflow-hidden">
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </div>
        <div className="flex justify-around items-center">
          <button className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
            <span className="mr-1 flex items-center justify-center">
              <FontAwesomeIcon icon={faEye} />
            </span>
            View Paper
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
export default NotesCard;