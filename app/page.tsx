import Link from "next/link";
import { SignIn } from "./components/sign-in";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <SignIn />
            <span>ExamCooker 2024</span>
            <Link href={"/past_papers"} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-md"> 
                Append '/past_papers' to localhost link in the searchbox, or click here.
            </Link>
            <Link href={"/notes"} className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-md"> 
                Append '/notes' to localhost link in the searchbox, or click here.
            </Link>
            <span ></span>
        </main>
    );
}
