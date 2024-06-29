"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import HeartIcon from './HeartIcon';

interface PastPaperCardProps {
  title: string;
  imageSrc: string;
}

const PastPaperCard: React.FC<PastPaperCardProps> = ({ title, imageSrc }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleFavouriteClick = () => {
    setIsFavorite(!isFavorite);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div className="max-w-xs mx-auto">
      <div className="p-4 w-full text-center bg-[#5fc4e7]" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div className="bg-[#d9d9d9] w-full h-48 mb-4 overflow-hidden">
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </div>
        <div className="flex justify-around items-center">
          <button className="py-2 px-2 text-sm flex items-center bg-white text-black hover:bg-gray-200">
            <span className="mr-1 flex items-center justify-center">
              <Image src="/assets/ViewIcon.svg" alt="View Icon" width={22} height={17} />
            </span>
            View
          </button>
          <button className="py-2 px-2 text-sm flex items-center bg-white text-black hover:bg-gray-200">
            More
            <span className="ml-2 flex items-center justify-center">
              <Image src="/assets/MoreIcon.svg" alt="More Icon" width={15} height={9} />
            </span>
          </button>
          <button onClick={handleFavouriteClick}>
            <span>
              <HeartIcon fill={isFavorite ? "grey" : "none"} />
            </span>
          </button>
        </div>
      </div>

      <div className={`w-full h-0.5 bg-white transition-opacity duration-300 ease-in-out ${isHovered ? 'opacity-100 shadow-[0px_5px_14px_0px_rgba(0,0,0,0.75)]' : 'opacity-0'}`}></div>
    </div>
  );
};

export default PastPaperCard;




