import React from "react";
import NotesCard from "@/app/components/NotesCard";
import HomeFooter from "./home_footer";
import ArrowRight from "@/public/assets/ArrowRight.svg";
import Image from "next/image";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";

const Home: React.FC = () => {
    const notes = [
        { id: 1, title: "Note 1", content: "Content for note 1" },
        { id: 2, title: "Note 2", content: "Content for note 2" },
        { id: 3, title: "Note 3", content: "Content for note 3" },
        { id: 4, title: "Note 4", content: "Content for note 4" },
        { id: 5, title: "Note 5", content: "Content for note 5" },
        { id: 6, title: "Note 6", content: "Content for note 6" },
        { id: 7, title: "Note 7", content: "Content for note 7" },
        { id: 8, title: "Note 8", content: "Content for note 8" },
    ];

    return (
        <div className="bg-[#C2E6EC] dark:bg-[#0C1222] min-h-screen text-black dark:text-[#D5D5D5] flex flex-col transition-colors">
            <div className="flex-grow">
                <div className="w-full px-8 mx-auto text-center justify-center mt-8">
                    <h1 className="text-3xl md:text-7xl mb-4">Welcome <GradientText><UserName /></GradientText></h1>
                    <p className="text-md mb-4 sm:text-xl font-lato">You've got this! Even if 'this' means a borderline psychotic level of caffeine consumption.</p>
                </div>

                <div className="w-full px-4">
                    <div className="flex items-center justify-center text-2xl font-bold pt-6 mb-2">
                        <div className="relative flex items-center justify-between">
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                            <span className="font-montserrat">Recently viewed</span>
                            <Image src={ArrowRight} alt="arrow" className="h-6 w-6 ml-2" />
                            <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                        </div>
                    </div>

                    <div className="flex justify-center h-[40vh] overflow-x-auto md:overflow-hidden">
                        <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6 md:max-h-[20rem]">
                            {notes.slice(0, 3).map((note, index) => (
                                <NotesCard 
                                    key={note.id} 
                                    index={index} 
                                    note={note} 
                                    className="max-h-[15rem] sm:max-h-[18rem] md:max-h-[20rem]" 
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <section className="mt-4 w-full px-4">
                    <div className="flex items-center justify-center text-2xl font-bold pt-6 mb-2">
                        <span className="font-montserrat">Favourites </span>
                        <Image src={ArrowRight} alt="arrow" className="h-6 w-6 ml-2" />
                    </div>

                    <div className="flex justify-center h-[40vh] overflow-x-auto md:overflow-visible">
                        <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                            {notes.map((note, index) => (
                                <NotesCard 
                                    key={note.id} 
                                    index={index} 
                                    note={note} 
                                    className="max-h-[15rem] sm:max-h-[18rem] md:max-h-[20rem]" 
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <HomeFooter />
        </div>
    );
};

export default Home;
