import React from "react";
import Image from "next/image";
import PastPaper from "@/public/LandingPage/LandingPagePastPapers.svg";
import Forum from "@/public/LandingPage/LandingPageForum.svg";
import Notes from "@/public/LandingPage/LandingPageNotes.svg";
import Resources from "@/public/LandingPage/LandingPageResourceRepo.svg";
import ArrowRight from "@/public/LandingPage/ArrowRight.svg"
import GradientHeart from '@/public/LandingPage/GradientHeart.svg';
import GradientACMLogo from "@/public/LandingPage/ACM Logo.svg"
import { SignIn } from "../components/sign-in";


function GradientText({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">{children}</span>
    );
}

function WordBetweenLine({ children }: { children: React.ReactNode }) {
    return (
        <div className='relative flex items-center justify-between'>
            <div className='flex-grow border-t border-black'></div>
            <span className='text-center text-3xl md:text-6xl lg:text-8xl font-extrabold flex-shrink text-black'>{children}</span>
            <div className='flex-grow border-t border-black'></div>
        </div>
    );
}

function LandingPageCard({ title, content, imagePath, altOfImage }: { title: string, content: string, imagePath: any, altOfImage: string }) {
    return (
        <div className="relative overflow-hidden group">
            <div className="hidden lg:block absolute left-0 top-0 w-[200px] h-[200px] rounded-full bg-none transition duration-1000 group-hover:duration-200 group-hover:bg-[#3BF4C7]">
            </div>
            <div className="block lg:hidden absolute left-0 top-0 w-[200px] h-[200px] rounded-full bg-[#3BF4C7]">
            </div>
            <div className="hidden lg:block absolute right-0 bottom-0 w-[200px] h-[200px] rounded-full transition duration-1000 group-hover:duration-200 md:bg-none md:group-hover:bg-[#82BEE9]">
            </div>
            <div className="block lg:hidden absolute right-0 bottom-0 w-[200px] h-[200px] rounded-full bg-[#82BEE9]">
            </div>

            <div className="relative w-full h-full bg-[#5FC4E7]/20 backdrop-blur-[100px] border-[#5FC4E7] border-[1px] p-1 md:p-4">
                <div className="flex items-center w-full justify-between">
                    <Image src={imagePath} alt={altOfImage} width={300} height={300} className="h-[100px] md:h-[300px]" />
                    <div className="flex-col gap-5">
                        <span className="text-2xl md:text-4xl font-extrabold">{title}</span>
                        <br />
                        <span className="text-lg">{content}</span>
                    </div>
                </div>
                <div className="flex justify-between">
                    <div />
                    <Image src={ArrowRight} alt="ArrowRight" width={35} height={35} />
                </div>
            </div>
        </div>);
}

function LandingPageContent() {
    const handlePastPapersClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert("Past Papers box clicked!");
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleForumClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert("Past Papers box clicked!");
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleNotesClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert("Past Papers box clicked!");
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    const handleResourcesClick = () => {
        // Implement logic for what happens when "Past Papers" box is clicked
        alert("Past Papers box clicked!");
        // You can add more logic here, like navigating to a different page or displaying more content
    };
    // <h4 className="drop-shadow-[0_35px_35px_rgba(0,0,0,1)]">Presenting [ExamCooker],your <br /> one-stop solution to Cram before Exams</h4>
    //
    const handleClick = () => {
        alert("Clicked!");
    }

    return (
        <div className='bg-[#C2E6EC] space-y-40 md:space-y-96'>
            <div className='px-5 py-5 md:px-40 md:py-20 w-full'>
                <h1 className="text-6xl md:text-7xl lg:text-9xl drop-shadow-[0px_5px_rgba(59,244,199,1)]"><GradientText>Cramming</GradientText></h1>
                <br />
                <h1 className="text-6xl md:text-7xl lg:text-9xl drop-shadow-[0px_5px_rgba(59,244,199,1)]">Made Easy</h1>
                <br />
                <div>
                    <h4 >Presenting [ExamCooker],your <br /> one-stop solution to Cram before Exams</h4>
                </div>
            </div>

            <div className="lg:sticky lg:top-0 lg:h-screen space-y-3">
                <WordBetweenLine><div className="drop-shadow-[0px_5px_rgba(59,244,199,1)]">For Crammers By Crammers</div></WordBetweenLine>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[5px] px-1 md:gap-[20px] md:px-4 max-w-[1475px] mx-auto">
                    <LandingPageCard title="Past Papers" content="Conquer Your Exam Anxieties using our plethora of past papers" imagePath={PastPaper} altOfImage="PastPaper" />
                    <LandingPageCard title="Forum" content="Connect with fellow crammers and ignite discussions with our Forum" imagePath={Forum} altOfImage="Forum" />
                    <LandingPageCard title="Notes" content="Access and Contribute to a vibrant collection of notes, created by students like you!" imagePath={Notes} altOfImage="Notes" />
                    <LandingPageCard title="Resource Repo" content="Expand your learning horizon through curated links to top-notch articles and videos" imagePath={Resources} altOfImage="ResourceRepo" />
                </div>
            </div>

            <div className="lg:sticky lg:top-0 lg:h-screen lg:bg-[#8DCAE9] flex-col content-center">
                <WordBetweenLine ><div className="text-center"><GradientText>Start Cooking Your<br /> Academic Success Today </GradientText></div></WordBetweenLine>
                <br />
                <div className="grid gap-8 justify-center">
                    <SignIn displayText="Sign In"/>
                </div>
            </div>

            <div className="lg:sticky lg:h-screen lg:top-0 lg:bg-[#C2E6EC] flex-col content-center">
                <WordBetweenLine><div className="drop-shadow-[0px_5px_rgba(59,244,199,1)]">Why Examcooker?</div></WordBetweenLine>
                <br />
                <h4 className="px-1 md:px-16 text-center">
                    Remember the days of desperately searching the web for past papers, only to get lost in a maze of irrelevant links?
                    <br />We do too! Thats why we built this website - a haven for students who are tired of the exam prep struggle.
                    <br />Here, everything you need to cram like a champion is under one roof.
                    <br /> <GradientText>Let&apos;s conquer those exams together!</GradientText>
                </h4>
            </div>

            <div className="lg:sticky lg:h-screen lg:top-0 lg:bg-[#8DCAE9] flex-col content-center">
                <WordBetweenLine >
                    <div className="flex items-center">
                        <span className="drop-shadow-[0px_5px_rgba(59,244,199,1)]">
                        Made With
                        </span>
                        <Image src={GradientHeart} alt="Gradient Heart" className="inline w-[55px] h-[55px] md:w-[150px] md:h-[150px]" />
                    </div>
                </WordBetweenLine>
                <div className="flex align-middle justify-center">
                    <Image src={GradientACMLogo} alt="ACM logo" className="w-[500px] md:w-[816px] md:h-[353px]" />
                </div>
            </div>

        </div>

    );
}

export default LandingPageContent;
