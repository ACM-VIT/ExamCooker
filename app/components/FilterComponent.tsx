//All of the following code is dummy, boilerplate. Replace with relevant material.


// components/FilterComponent.tsx
import React from 'react'

const FilterComponent: React.FC = () => {
  return (
    <div className="border p-4 shadow-md rounded-md w-60">
      <div className="flex items-center mb-4">
        <input
          type="text"
          placeholder="Search..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-500"
        />
      </div>
      <div className="flex flex-wrap">
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2 mb-2 hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
          Keyword 1
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2 mb-2 hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
          Keyword 2
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2 mb-2 hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
          Keyword 3
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2 mb-2 hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
          Keyword 4
        </button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-md mr-2 mb-2 hover:bg-blue-600 focus:outline-none focus:bg-blue-600">
          Keyword 5
        </button>
      </div>
    </div>
  )
}

export default FilterComponent
