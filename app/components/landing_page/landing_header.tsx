import React from "react";
import { SignIn } from "../sign-in";

function Header() {
    return (
        <header className="bg-[#CCF3FF] py-12 text-center">
            <div className="container max-w-xl mx-auto px-4 sm:px-8">
                <h1 className="text-4xl mb-2 text-[#0070f3] sm:text-5xl">
                    Cramming,
                    <br className="sm:hidden" /> Made Easy.
                </h1>
                <p className="text-lg mb-4 sm:text-xl">
                    Presenting ExamCooker, your one-stop solution to cram before
                    exams
                </p>
                <SignIn displayText="Login" />
            </div>
        </header>
    );
}

export default Header;
