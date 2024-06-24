///All of the following code is dummy, boilerplate. Replace with relevant material.

// components/NotesCard.tsx
import React from 'react'

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
