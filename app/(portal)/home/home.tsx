import React from "react";
import HomeHeader from "./home_header";


const Home: React.FC = () => {
    return (
        <div className="bg-[#C2E6EC] min-h-screen">
            <HomeHeader />
            <main>
                <section className="mt-4">
                    <div className="flex items-center mb-6">
                        <hr className="flex-grow border-t-3 border-black mr-4" />
                        <p className="text-2xl">Recently viewed</p>
                        <hr className="flex-grow border-t-3 border-black ml-4" />
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Home;
