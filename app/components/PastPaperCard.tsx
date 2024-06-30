"use client";

import React, { useState } from 'react';
import Image from 'next/image';

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
          <button onClick={handleFavouriteClick} className="p-0">
            <span
              dangerouslySetInnerHTML={{
                __html: `<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4.45067 14.4082L11.4033 20.9395C11.6428 21.1644 11.7625 21.2769 11.9037 21.3046C11.9673 21.3171 12.0327 21.3171 12.0963 21.3046C12.2375 21.2769 12.3572 21.1644 12.5967 20.9395L19.5493 14.4082C21.5055 12.5706 21.743 9.5466 20.0978 7.42607L19.7885 7.02734C17.8203 4.49058 13.8696 4.91601 12.4867 7.81365C12.2913 8.22296 11.7087 8.22296 11.5133 7.81365C10.1304 4.91601 6.17972 4.49058 4.21154 7.02735L3.90219 7.42607C2.25695 9.5466 2.4945 12.5706 4.45067 14.4082Z"
                    stroke="#838383"
                    strokeWidth="2"
                    fill="${isFavorite ? "grey" : "none"}"
                  />
                </svg>`,
              }}
            />
          </button>
        </div>
      </div>

      <div className={`w-full h-0.5 bg-white transition-opacity duration-300 ease-in-out ${isHovered ? 'opacity-100 shadow-[0px_5px_14px_0px_rgba(0,0,0,0.75)]' : 'opacity-0'}`}></div>
    </div>
  );
};

export default PastPaperCard;
