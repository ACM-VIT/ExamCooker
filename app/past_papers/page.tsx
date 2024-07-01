import React from "react";
import Pagination from "../components/Pagination";
import PastPaperCard from "../components/PastPaperCard";
import FilterComponent from "../components/FilterComponent";
import SearchBar from "../components/SearchBar";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

async function pastPaperPage() {
    
    const prisma = new PrismaClient();
    const pastPapers = await prisma.pastPaper.findMany({
        include : {
        author : true,
        }
    });

    return (
        <div>
            <h1 className="text-4xl font-bold text-center">Past Papers</h1>
            {/* back button */}
            <Link
                href={"/"}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600"
            >
                Back
            </Link>

            {/* searchbar */}

            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Search Example</h1>
                <SearchBar />
                {/* Other content of your page */}
            </div>

            <div className="flex gap-6" >
                {pastPapers.map((eachPaper, index) => (

                                    <PastPaperCard note={eachPaper}
                                        //content="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
                                    />
                    ))}

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
    );
}

export default pastPaperPage;
