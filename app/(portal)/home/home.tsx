import React from "react";
import HomeHeader from "./home_header";
import NotesCard from "@/app/components/NotesCard"; // Import the NotesCard component
import HomeFooter from "./home_footer";

const Home: React.FC = () => {
    // Sample notes data
    const notes = [
        { id: 1, title: "Note 1", content: "Content for note 1" },
        { id: 2, title: "Note 2", content: "Content for note 2" },
        { id: 3, title: "Note 3", content: "Content for note 3" },
        { id: 4, title: "Note 4", content: "Content for note 4" },
    ];

    return (
        <><HomeHeader />
                    <main>
                <section className="mt-4">
                    <div className="flex items-center mb-6">
                        <hr className="flex-grow border-t-3 border-black mr-4" />
                        <p className="text-2xl pt-2">Recently viewed</p>
                        <hr className="flex-grow border-t-3 border-black ml-4" />
                    </div>
                    <div className="flex justify-center">
                        <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                            {notes.map((note, index) => (
                                <NotesCard key={note.id} index={index} note={notes} />
                            ))}
                        </div>
                    </div>
                </section>
                <section className="mt-4"><div className="flex items-center mb-6">
                    <hr className="flex-grow border-t-3 border-black mr-4" />
                    <p className="text-2xl pt-2">Favoruites ❤️</p>
                    <hr className="flex-grow border-t-3 border-black ml-4" />
                </div>
                    <div className="flex justify-center">
                        <div className="w-3/4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-6">
                            {notes.map((note, index) => (
                                <NotesCard key={note.id} index={index} note={notes} />
                            ))}
                        </div>
                    </div></section>
                    <HomeFooter/>
            </main></>
    );
};

export default Home;
