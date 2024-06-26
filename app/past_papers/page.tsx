import React from 'react'
import Pagination from '../components/Pagination'
import FilterComponent from '../components/FilterComponent'
import SearchBar from '../components/SearchBar'
import Link from 'next/link'
import PastPaperCard from '../components/PastPaperCard'


const page = () => {
  return (
    <div>
        <h1 className="text-4xl font-bold text-center">Past Papers</h1>
        {/* back button */}
        <Link href={"/"}  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600" >Back</Link>

         {/* searchbar */}

         <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Search Example</h1>

            <SearchBar />


        </div>

        {/* pastPaperCard */}

        <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Past Papers</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <PastPaperCard
                imageSrc="https://friendsofus.com/wp-content/uploads/2021/07/image-removebg-preview-9-modified.png"
                title="Mathematics Past Paper"
                />

                <PastPaperCard
                imageSrc="https://ipwatchdog.com/wp-content/uploads/2018/03/pepe-the-frog-1272162_640.jpg"
                title="Physics Past Paper"
                />
                {/* Add more PastPaperCard instances as needed */}
            </div>
        </div>

        {/* filter */}
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Dummy Filter</h1>
            <div className="flex justify-start">
                <FilterComponent />
            </div>
            {/* Other content of your page */}
        </div>


        {/* pagination */}
        <Pagination currentPage={1} totalPages={69}></Pagination>
    </div>
  )
}

export default page