// ///All of the following code is dummy, boilerplate. Replace with relevant material.

// // components/PastPaperCard.tsx
// // import React from 'react';

// // interface PastPaperCardProps {
// //   imageSrc: string;
// //   title: string;
// //   content?: string; // Make content optional if it might not always be present
// // }

// // const PastPaperCard: React.FC<PastPaperCardProps> = ({ imageSrc, title, content }) => {
// //   return (
// //     <div className="border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
// //       <div className="mb-4">
// //         <img src={imageSrc} alt={title} className="w-full h-48 object-cover" />
// //       </div>
// //       <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
// //       {content && <p className="text-gray-600">{content}</p>}
// //     </div>
// //   );
// // };

// // export default PastPaperCard;

"use client";

import React, { useState } from 'react';

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
              <svg width="22" height="17" viewBox="0 0 22 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 1.5C5.55576 1.5 2.53109 5.73425 1.45554 7.61639C1.23488 8.00252 1.12456 8.19558 1.1367 8.4836C1.14885 8.77161 1.27857 8.9598 1.53799 9.33619C2.8182 11.1935 6.29389 15.5 11 15.5C15.7061 15.5 19.1818 11.1935 20.462 9.33619C20.7214 8.9598 20.8511 8.77161 20.8633 8.4836C20.8754 8.19558 20.7651 8.00252 20.5445 7.61639C19.4689 5.73425 16.4442 1.5 11 1.5Z" stroke="black" stroke-width="2"/>
                <circle cx="11" cy="8.5" r="4" fill="black"/>
              </svg>
            </span>
            View
          </button>
          <button className="py-2 px-2 text-sm flex items-center bg-white text-black hover:bg-gray-200">
            More
            <span className="ml-2 flex items-center justify-center">
              <svg width="15" height="9" viewBox="0 0 15 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M8.38389 8.62345C7.89577 9.12552 7.10426 9.12552 6.61614 8.62345L0.366113 2.19486C-0.122038 1.69275 -0.122038 0.878686 0.366113 0.376574C0.854277 -0.125525 1.64573 -0.125525 2.13389 0.376574L7.50002 5.89605L12.8662 0.376574C13.3543 -0.125525 14.1458 -0.125525 14.6339 0.376574C15.122 0.878686 15.122 1.69275 14.6339 2.19486L8.38389 8.62345Z" fill="black"/>
              </svg>
            </span>
          </button>
          <button onClick={handleFavouriteClick}>
            <span>
              <svg width="24" height="25" viewBox="0 0 24 25" fill={isFavorite ? "grey" : "none"} xmlns="http://www.w3.org/2000/svg">
                <path d="M4.45067 14.4082L11.4033 20.9395C11.6428 21.1644 11.7625 21.2769 11.9037 21.3046C11.9673 21.3171 12.0327 21.3171 12.0963 21.3046C12.2375 21.2769 12.3572 21.1644 12.5967 20.9395L19.5493 14.4082C21.5055 12.5706 21.743 9.5466 20.0978 7.42607L19.7885 7.02734C17.8203 4.49058 13.8696 4.91601 12.4867 7.81365C12.2913 8.22296 11.7087 8.22296 11.5133 7.81365C10.1304 4.91601 6.17972 4.49058 4.21154 7.02735L3.90219 7.42607C2.25695 9.5466 2.4945 12.5706 4.45067 14.4082Z" stroke="#838383" strokeWidth="2"/>
              </svg>
            </span>
          </button>
        </div>
      </div>

      <div className={`w-full h-0.5 bg-white transition-opacity duration-300 ease-in-out ${isHovered ? 'opacity-100 shadow-[0px_5px_14px_0px_rgba(0,0,0,0.75)]' : 'opacity-0'}`}></div>
    </div>
  );
};

export default PastPaperCard;


