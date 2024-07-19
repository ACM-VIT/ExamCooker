import React from "react";
import NotesCard from "@/app/components/NotesCard";
import UserName from "./display_username";
import { GradientText } from "@/app/components/landing_page/landing";

function getQuirkyLine() {
    const collection : string[] = [
        "You've got this! Even if 'this' means a borderline psychotic level of caffeine consumption.",
        "They laughed when I said I'd learn a semester's worth of material in one night. Now they're asking for my notes. #Who'sLaughingNow?",
        "Sleep is for the victors... of tomorrow's nap.",
        "Sleep is optional, caffeine is mandatory",
        "You might not feel like a genius now, but you will after this exam.",
        "Practice makes progress... and hopefully, perfection.",
        "Share your knowledge, save a life (or at least a grade)",
        "I'm not lazy, I'm just selectively productive.",
        "Coffee is my superpower.",
        "This coffee is keeping my sanity intact."
    ]

    return collection[Math.floor(Math.random() * collection.length)];
}

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
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <header className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome <GradientText><UserName /></GradientText></h1>
                    <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">{getQuirkyLine()}</p>
                </header>

                <main>
                    <section className="mb-16">
                         <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5] "></div>
                        <span className="mx-4">Recently Viewed</span>
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {notes.slice(0, 3).map((note, index) => (
                                <NotesCard
                                    key={note.id}
                                    index={index}
                                    note={note}
                                    className="w-full"
                                />
                            ))}
                        </div>
                    </section>

                    <section>
                    <div className="flex items-center justify-center text-xl sm:text-2xl font-bold mb-6 pt-4">
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5] "></div>
                        <span className="mx-4">Favourites</span>
                        <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                            {notes.map((note, index) => (
                                <NotesCard
                                    key={note.id}
                                    index={index}
                                    note={note}
                                    className="w-full"
                                />
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Home;