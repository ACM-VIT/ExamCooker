"use client";
import React from "react";
import Image from "next/image";
import PastPaper from "@/public/LandingPage/LandingPagePastPapers.svg";
import Forum from "@/public/LandingPage/LandingPageForum.svg";
import Notes from "@/public/LandingPage/LandingPageNotes.svg";
import Resources from "@/public/LandingPage/LandingPageResourceRepo.svg";
import ArrowRight from "@/public/LandingPage/ArrowRight.svg"
import GradientHeart from '@/public/LandingPage/GradientHeart.svg';
import GradientACMLogo from "@/public/LandingPage/ACM Logo.svg"


function GradientText({ content }: { content: string }) {
    return (
        <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">{content}</span>
    );
}

function WordBetweenLine({ children }: { children: React.ReactNode }) {
    return (
        <div className='relative flex items-center justify-between'>
            <div className='flex-grow border-t border-black'></div>
            <span className='text-8xl font-extrabold flex-shrink mx-4 text-black'>{children}</span>
            <div className='flex-grow border-t border-black'></div>
        </div>
    );
}

function BlurredCircle() {
    return (
        <div className="rounded-full bg-black w-[400px] h-[400px] blur-[90px] absolute">
        </div>
    );
}

function LandingPageCard({ title, content, imagePath, altOfImage }: { title: string, content: string, imagePath: any, altOfImage: string }) {
    return (
        <div className="relative overflow-hidden">
            <div className="absolute w-[100px] h-[200px] rounded-full  bg-[#3BF4C7]">
            </div>
            <div className="absolute w-[100px] h-[200px] rounded-full  bg-[#3BF4C7]">
            </div>
            <div className="relative w-fit bg-[#5FC4E7]/20 backdrop-blur-[150px] border-[#5FC4E7] border-[1px] p-4">
                <div className="flex items-center w-full justify-between">
                    <Image src={imagePath} alt={altOfImage} width={300} height={300} className="h-[150px] md:h-[300px]" />
                    <div className="flex-col gap-5">
                        <span className="text-4xl font-extrabold inline-block">{title}</span>
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

    return (
        <div className='bg-[#C2E6EC]'>
            <div className='mx-36 mt-14 mb-96'>
                <h1 className="text-9xl"><GradientText content="Cramming" /></h1>
                <br />
                <h1 className="text-9xl drop-shadow-[0px_5px_rgba(59,244,199,1)]">Made Easy</h1>
                <br />
                <div>
                <h4 >Presenting [ExamCooker],your <br /> one-stop solution to Cram before Exams</h4>
                    
                </div>
            </div>
            <br />
            <br />
            <br />

            <WordBetweenLine><div className="drop-shadow-[0px_5px_rgba(59,244,199,1)]">For Crammers By Crammers</div></WordBetweenLine>
            <div className="mb-32"></div>

            <div className="grid grid-cols-1 md:px-12 sm:grid-cols-2 gap-3 md:gap-[75px] max-w-[1475px] mx-auto mb-96">
                <LandingPageCard title="Past Papers" content="Conquer Your Exam Anxieties using our plethora of past papers" imagePath={PastPaper} altOfImage="PastPaper" />
                <LandingPageCard title="Forum" content="Connect with fellow crammers and ignite discussions with our Forum" imagePath={Forum} altOfImage="Forum" />
                <LandingPageCard title="Notes" content="Access and Contribute to a vibrant collection of notes, created by students like you!" imagePath={Notes} altOfImage="Notes" />
                <LandingPageCard title="Resource Repo" content="Expand your learning horizon through curated links to top-notch articles and videos" imagePath={Resources} altOfImage="ResourceRepo" />
            </div>

            <WordBetweenLine >Why Examcooker?</WordBetweenLine>

            <br />
            <h4 className="px-16 text-center mb-96">
                Remember the days of desperately searching the web for past papers, only to get lost in a maze of irrelevant links?
                <br />We do too! Thats why we built this website - a haven for students who are tired of the exam prep struggle.
                <br />Here, everything you need to cram like a champion is under one roof.
                <br /> <GradientText content="Let's conquer those exams together!" />
            </h4>

            <WordBetweenLine >
                <div className="flex items-center">
                    Made With
                    <Image src={GradientHeart} alt="Gradient Heart" width={150} height={150} className="inline" />
                </div>
            </WordBetweenLine>

            <br />
            <br />
            <br />
            <div className="flex align-middle justify-center">
                <Image src={GradientACMLogo} alt="ACM logo" width={816} height={353} />
            </div>

        </div>
    );
}

export default LandingPageContent;
