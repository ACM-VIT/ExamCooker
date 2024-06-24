import React from 'react'
import Pagination from '../components/Pagination'
import NotesCard from '../components/NotesCard'
import FilterComponent from '../components/FilterComponent'
import SearchBar from '../components/SearchBar'
import Link from 'next/link'


const notesPage = () => {
  return (
    <div>
        <h1 className="text-4xl font-bold text-center">Notes</h1>
        {/* back button */}
        <Link href={"/"}  className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600" >Back</Link>

         {/* searchbar */}

         <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Search Example</h1>
            <SearchBar />
            {/* Other content of your page */}
        </div>



        {/* notescard */}
        <div className="container mx-auto p-4 flex justify-center">
                    {/* Center horizontally with flex justify-center */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Center each NotesCard vertically with flex items-center */}
                        <div className="flex justify-center items-center">
                        <NotesCard 
                            imageSrc="https://avatars.githubusercontent.com/u/128067781?v=4"
                            title="Sample Note"
                            content="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
                        />
                        </div>
                        <div className="flex justify-center items-center">
                        <NotesCard 
                            imageSrc="https://images.moneycontrol.com/static-mcnews/2022/03/pjimage-11-4-770x433.jpg?impolicy=website&width=770&height=431"
                            title="Another Note"
                            content="Integer congue libero sed augue rutrum lacinia."
                        />
                        </div>
                        {/* Add more NotesCard components as needed */}
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

export default notesPage