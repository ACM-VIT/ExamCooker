///All of the following code is dummy, boilerplate. Replace with relevant material.

// components/PastPaperCard.tsx
import React from 'react';

interface PastPaperCardProps {
  imageSrc: string;
  title: string;
  content?: string; // Make content optional if it might not always be present
}

const PastPaperCard: React.FC<PastPaperCardProps> = ({ imageSrc, title, content }) => {
  return (
    <div className="border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
      <div className="mb-4">
        <img src={imageSrc} alt={title} className="w-full h-48 object-cover" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
      {content && <p className="text-gray-600">{content}</p>}
    </div>
  );
};

export default PastPaperCard;
