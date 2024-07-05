// "use client";

// import React from 'react';
// import { useState } from 'react';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faEye, faCaretDown, faHeart } from '@fortawesome/free-solid-svg-icons';
// import { PastPaper } from '@prisma/client';
// import Link from 'next/link';

// interface PastPaperCardProps {
//   pastPaper: PastPaper;
// }

// function PastPaperCard({ pastPaper }: PastPaperCardProps) {
//   const [isFav, setIsFav] = useState(false);

//   function FavpeCLick() {
//     setIsFav(!isFav);
//   }

//   return (
//     <div className="max-w-sm w-full">
//       <div className="p-4 w-full text-center bg-[#5fc4e7]">
//         <div className="bg-[#d9d9d9] w-full h-36 mb-4 overflow-hidden">
//           <img src="https://topperworld.in/media/2022/11/c-sc.png" alt={pastPaper.title} className="w-full h-full object-cover" />
//         </div>
//         <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
//           {pastPaper.title}
//         </div>
//         <div className="flex justify-around items-center space-x-4">
//           <Link href={`past_papers/${pastPaper.id}`} className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
//             <span className="mr-1 flex items-center justify-center">
//               <FontAwesomeIcon icon={faEye} />
//             </span>
//             View Paper
//           </Link>

//           <button onClick={FavpeCLick} style={{ color: isFav ? 'red' : 'lightgrey' }}>
//             <FontAwesomeIcon icon={faHeart} />
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// };
// export default PastPaperCard;

"use client";
import React from 'react';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faHeart } from '@fortawesome/free-solid-svg-icons';
import { PastPaper } from '@prisma/client';
import Link from 'next/link';

interface PastPaperCardProps {
  pastPaper: PastPaper;
  index: number;
}

const colors = ['#5FC4E7', '#82BEE9'];

function PastPaperCard({ pastPaper, index }: PastPaperCardProps) {
  const [isFav, setIsFav] = useState(false);

  function toggleFav() {
    setIsFav(!isFav);
  }

  return (
    <div className="max-w-sm w-full">
      <div className="p-4 w-full text-center" style={{ backgroundColor: colors[index % colors.length] }}>
        <div className="bg-[#d9d9d9] w-full h-36 mb-4 overflow-hidden">
          <img
            src="https://topperworld.in/media/2022/11/c-sc.png"
            alt={pastPaper.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="mb-2 text-black w-full whitespace-nowrap overflow-hidden text-ellipsis">
          {pastPaper.title}
        </div>
        <div className="flex justify-between items-center space-x-4">
          <div></div>
          <Link href={`past_papers/${pastPaper.id}`} className="py-[2.605%] px-2 text-sm flex items-center bg-white text-black">
            <span className="mr-1 flex items-center justify-center">
              <FontAwesomeIcon icon={faEye} />
            </span>
            View 
          </Link>
          <button onClick={toggleFav} style={{ color: isFav ? 'red' : 'lightgrey' }}>
            <FontAwesomeIcon icon={faHeart} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PastPaperCard;
