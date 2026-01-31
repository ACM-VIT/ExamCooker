import React from "react";
import Image from "next/image";
import PastPaper from "@/public/LandingPage/LandingPagePastPapers.svg";
import Forum from "@/public/LandingPage/LandingPageForum.svg";
import Notes from "@/public/LandingPage/LandingPageNotes.svg";
import Resources from "@/public/LandingPage/LandingPageResourceRepo.svg";
import ArrowRight from "@/public/LandingPage/ArrowRight.svg";
import GradientHeart from "@/public/LandingPage/GradientHeart.svg";
import GradientACMLogo from "@/public/assets/ACM logo.svg";
import { SignIn } from "../sign-in";
import Link from "next/link";
import BookAndBoy from "@/public/assets/bookandboy.svg";

export function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">
      {children}
    </span>
  );
}

function WordBetweenLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center justify-between">
      <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
      <span className="text-center text-3xl md:text-6xl lg:text-8xl font-extrabold flex-shrink text-black dark:text-[#D5D5D5]">
        {children}
      </span>
      <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
    </div>
  );
}

function LandingPageCard({
  title,
  content,
  imagePath,
  altOfImage,
}: {
  title: string;
  content: string;
  imagePath: any;
  altOfImage: string;
}) {
  return (
    <Link href={"#sign-in"} className="relative overflow-hidden group">
      <div className="hidden lg:block absolute left-0 top-0 w-[150px] h-[150px] rounded-full bg-none transition duration-1000 group-hover:duration-200 group-hover:bg-[#3BF4C7]"></div>
      <div className="block lg:hidden absolute left-0 top-0 w-[100px] h-[100px] rounded-full bg-[#3BF4C7]"></div>
      <div className="hidden lg:block absolute right-0 bottom-0 w-[150px] h-[150px] rounded-full transition duration-1000 group-hover:duration-200 md:bg-none md:group-hover:bg-[#82BEE9]"></div>
      <div className="block lg:hidden absolute right-0 bottom-0 w-[100px] h-[100px] rounded-full bg-[#82BEE9]"></div>

      <div className="relative flex flex-col justify-between w-full h-full bg-[#5FC4E7]/20 dark:bg-[#7D7467]/20 backdrop-blur-[100px] border-[#5FC4E7]/20 dark:border-[#7D7467]/20 border p-1 md:p-4">
        <div className="flex items-center w-full h-[150px] md:h-5/6 justify-between">
          <Image
            src={imagePath}
            alt={altOfImage}
            className="h-[75%] lg:h-[90%] dark:invert-[.835] dark:hue-rotate-180"
          />
          <div className="flex-col gap-5">
            <span className="text-xl md:text-4xl font-extrabold">{title}</span>
            <br />
            <span className="text-sm md:text-lg">{content}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <div />
          <Image
            src={ArrowRight}
            alt="ArrowRight"
            className="md:h-[35px] h-[20px] dark:invert-[0.835]"
          />
        </div>
      </div>
    </Link>
  );
}

function LandingPageContent() {
  return (
    <div className="bg-[#C2E6EC] dark:bg-[#0C1222]  transition-colors ease-in space-y-40 md:space-y-96 text-black dark:text-[#D5D5D5]">
      <div className="flex flex-col md:flex-row justify-around items-center lg:items-start gap-0 lg:gap-4">
        <div className="p-10 w-fit">
          <h1 className="text-6xl md:text-7xl lg:text-9xl drop-shadow-[0px_2px_rgba(59,244,199,1)]">
            <GradientText>Cramming</GradientText>
          </h1>
          <br />
          <h1 className="text-6xl md:text-7xl lg:text-9xl drop-shadow-[0px_2px_rgba(59,244,199,1)]">
            Made Easy
          </h1>
          <br />
          <div>
            <h4>
              Presenting ExamCooker, your <br /> one-stop solution to Cram
              before Exams
            </h4>
            <div className="mt-6">
              <Link
                href="/home"
                title="Open ExamCooker"
                className="relative group inline-flex"
              >
                <span className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                <span className="absolute inset-0 blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                <span className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#82BEE9] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                  Open ExamCooker
                </span>
              </Link>
            </div>
          </div>
        </div>
        <Image
          src={BookAndBoy}
          alt="Landing Page Image"
          className="h-[250px] lg:h-screen"
        />
      </div>
      <div className="lg:sticky lg:top-0 lg:h-screen space-y-5">
        <WordBetweenLine>
          <div className="drop-shadow-[0px_2px_rgba(59,244,199,1)]">
            For Crammers By Crammers
          </div>
        </WordBetweenLine>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[5px] md:gap-5 mx-auto md:h-3/4 w-[90%] md:max-w-[75%]">
          <LandingPageCard
            title="Past Papers"
            content="Conquer Your Exam Anxieties using our plethora of past papers"
            imagePath={PastPaper}
            altOfImage="PastPaper"
          />
          <LandingPageCard
            title="Forum"
            content="Connect with fellow crammers and ignite discussions with our Forum"
            imagePath={Forum}
            altOfImage="Forum"
          />
          <LandingPageCard
            title="Notes"
            content="Access and Contribute to a vibrant collection of notes, created by students like you!"
            imagePath={Notes}
            altOfImage="Notes"
          />
          <LandingPageCard
            title="Resource Repo"
            content="Expand your learning horizon through curated links to top-notch articles and videos"
            imagePath={Resources}
            altOfImage="ResourceRepo"
          />
        </div>
      </div>

      <div className="lg:sticky lg:top-0 lg:h-screen lg:bg-[#8DCAE9] bg-none lg:dark:bg-[#0C1222]/20 backdrop-blur-[150px] content-center overflow-hidden">
        <div className="hidden lg:block absolute top-0  right-0  w-[200px] h-[100px] rounded-full blur-[100px] bg-none transition duration-1000 bg-[#8DCAE9]"></div>
        <div className="hidden lg:block absolute bottom-0 left-0  w-[200px] h-[100px] rounded-full blur-[100px] bg-none transition duration-1000 bg-[#8DCAE9]"></div>
        <WordBetweenLine>
          <div id="sign-in" className="text-center">
            <GradientText>
              Start Cooking Your
              <br /> Academic Success Today{" "}
            </GradientText>
          </div>
        </WordBetweenLine>
        <br />
        <div className="grid gap-8 justify-center">
          <SignIn displayText="Sign In" />
        </div>
      </div>

      <div className="lg:sticky lg:h-screen lg:top-0 lg:bg-[#C2E6EC] lg:dark:bg-[#0C1222] flex-col content-center">
        <WordBetweenLine>
          <div className="drop-shadow-[0px_2px_rgba(59,244,199,1)]">
            Why Examcooker?
          </div>
        </WordBetweenLine>
        <br />
        <h4 className="px-1 md:px-16 text-center">
          Remember the days of desperately searching the web for past papers,
          only to get lost in a maze of irrelevant links?
          <br />
          We do too! Thats why we built this website - a haven for students who
          are tired of the exam prep struggle.
          <br />
          Here, everything you need to cram like a champion is under one roof.
          <br />{" "}
          <GradientText>Let&apos;s conquer those exams together!</GradientText>
        </h4>
      </div>

      <div className="lg:sticky lg:h-screen lg:top-0 lg:bg-[#8DCAE9] lg:dark:bg-[#0C1222]/20 backdrop-blur-[100px] flex-col content-center">
        <WordBetweenLine>
          <div className="flex items-center">
            <span className="drop-shadow-[0px_2px_rgba(59,244,199,1)]">
              Made With
            </span>
            <Image
              src={GradientHeart}
              alt="Gradient Heart"
              className="inline w-[55px] h-[55px] md:w-[150px] md:h-[150px]"
            />
          </div>
        </WordBetweenLine>
        <div className="flex align-middle justify-center">
          <Image
            src={GradientACMLogo}
            alt="ACM logo"
            className="w-[250px] md:w-[750px] md:h-[353px]"
          />
        </div>
      </div>
    </div>
  );
}

export default LandingPageContent;
