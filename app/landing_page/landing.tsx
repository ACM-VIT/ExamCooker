"use client"
import React from 'react';
import Image from 'next/image';
import pastPaper from '/ACM/TEST/ExamCooker-2024/public/assets/PastPapersIcon.svg';
import forum from '/ACM/TEST/ExamCooker-2024/public/assets/ForumIcon.svg';
import notes from '/ACM/TEST/ExamCooker-2024/public/assets/NotesIcon.svg';
import resources from '/ACM/TEST/ExamCooker-2024/public/assets/resourcesIcon.svg';

function Features() {
    const handlePastPapersClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert('Past Papers box clicked!');
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleForumClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert('Past Papers box clicked!');
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleNotesClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert('Past Papers box clicked!');
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleResourcesClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert('Past Papers box clicked!');
        // You can add more logic here, like navigating to a different page or displaying more content
    };

    return (
        <section className="text-center py-12 bg-[#CCF3FF]">
            <h2 className="text-2xl mb-8">For Crammers By Crammers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <button onClick={handlePastPapersClick} className="focus:outline-none">
                    <div style={{
                        backgroundImage: 'linear-gradient(135deg, #85E3E0, #92CEEA)',
                        backgroundColor: '#85E3E0',
                        opacity: '0.9',
                    }} className=" bg-opacity-25 backdrop-filter backdrop-blur-lg shadow-md hover:shadow-lg rounded-lg p-6">
                        <div className="flex justify-center mb-4">
                            <Image
                                src={pastPaper}
                                alt="Past Papers Icon"
                                width={50}
                                height={50}
                            />
                        </div>
                        <h3 className="text-xl mb-2">Past Papers</h3>
                        <p className="text-sm sm:text-base">
                            Practice makes perfect. Solve Previous Year Questions and get ready for the exams.
                        </p>
                    </div>
                </button>
                {/* Repeat the same structure for other boxes */}
                <button onClick={handleForumClick} className="focus:outline-none">
                <div style={{
                    backgroundImage: 'linear-gradient(135deg, #85E3E0, #92CEEA)',
                    backgroundColor: '#85E3E0',
                    opacity: '0.9',
                }} className=" bg-opacity-25 backdrop-filter backdrop-blur-lg shadow-md hover:shadow-lg rounded-lg p-6">
                    <div className="flex justify-center mb-4">
                        <Image
                            src={forum}
                            alt="Forum Icon"
                            width={50}
                            height={50}
                        />
                    </div>
                    <h3 className="text-xl mb-2">Forum</h3>
                    <p className="text-sm sm:text-base">
                        Connect and learn from fellow crammers in our community forum.
                    </p>
                </div>
                </button>

                <button onClick={handleNotesClick} className="focus:outline-none">
                <div style={{
                    backgroundImage: 'linear-gradient(135deg, #85E3E0, #92CEEA)',
                    backgroundColor: '#85E3E0',
                    opacity: '0.9',
                }} className=" bg-opacity-25 backdrop-filter backdrop-blur-lg shadow-md hover:shadow-lg rounded-lg p-6">
                    <div className="flex justify-center mb-4">
                        <Image
                            src={notes}
                            alt="Notes Icon"
                            width={50}
                            height={50}
                        />
                    </div>
                    <h3 className="text-xl mb-2">Notes</h3>
                    <p className="text-sm sm:text-base">
                        Summarized notes from top performers to help you revise quickly.
                    </p>
                </div>
                </button>

                <button onClick={handleResourcesClick} className="focus:outline-none">
                <div style={{
                    backgroundImage: 'linear-gradient(135deg, #85E3E0, #92CEEA)',
                    backgroundColor: '#85E3E0',
                    opacity: '0.9',
                }} className=" bg-opacity-25 backdrop-filter backdrop-blur-lg shadow-md hover:shadow-lg rounded-lg p-6">
                    <div className="flex justify-center mb-4">
                        <Image
                            src={resources}
                            alt="Resource Repo Icon"
                            width={50}
                            height={50}
                        />
                    </div>
                    <h3 className="text-xl mb-2">Resource Repo</h3>
                    <p className="text-sm sm:text-base">
                        Access a variety of resources to aid your studies.
                    </p>
                </div>
                </button>
            </div>
        </section>
    );
}

export default Features;
