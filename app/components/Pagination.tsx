//All of the following code is dummy, boilerplate. Replace with relevant material.


// components/Pagination.tsx
import React from 'react'
import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages }) => {
  return (
    // removed fixed class from pagination because it was clashing with the navbar
    <div className="bottom-0 left-0 right-0 flex items-center justify-center bg-white py-4 shadow-lg">
      {currentPage > 1 && (
        <Link href={`/?page=${currentPage - 1}`} legacyBehavior>
          <a className="mx-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300">
            Previous
          </a>
        </Link>
      )}
      <span className="text-gray-700 mx-2"> Page {currentPage} of {totalPages} </span>
      {currentPage < totalPages && (
        <Link href={`/?page=${currentPage + 1}`} legacyBehavior>
          <a className="mx-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300">
            Next
          </a>
        </Link>
      )}
    </div>
  )
}

export default Pagination
