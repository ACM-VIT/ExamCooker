import Link from "next/link";
import { SignIn } from "./components/sign-in";
import { SignOut } from "./components/sign-out";
import { auth } from "./auth";
import Header from "./landing_page/landing_header";
import Features from "./landing_page/landing";
import Footer from "./landing_page/land_footer";

export default async function Home() {
    const session = await auth();
    return (
        <>
            {!session ? (
                //TODO: Add your landing page here
                <div className="min-h-screen bg-[#5fc4e7] flex flex-col">
                    <Header />
                    <Features />
                    <div className="flex flex-col items-center py-12 bg-[#CCF3FF]">
                        <span className="text-3xl font-semibold mb-4">Start Cooking Your Academic Success Today</span>
                        <SignIn />
                    </div>
                    <Footer />
                </div>
            ) : (
                //TDOD: Add your home page here
                <div className="flex h-screen w-full bg-[#CCF3FF] flex-col items-center justify-between p-24">
                    <span>ExamCooker 2024</span>
                    <SignOut />
                    <Link
                        href={"/past_papers"}
                        className="bg-[#CCF3FF] text-white px-4 py-2 rounded-md shadow-md"
                    >
                        Append &apos;/past_papers&apos; to localhost link in the
                        searchbox, or click here.
                    </Link>
                    <Link
                        href={"/notes"}
                        className="bg-[#CCF3FF] text-white px-4 py-2 rounded-md shadow-md"
                    >
                        Append &apos;/notes&apos; to localhost link in the
                        searchbox, or click here.
                    </Link>
                </div>
            )}
        </>
    );
}
