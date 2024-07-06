import Link from "next/link";
import { SignOut } from "../components/sign-out";
import { auth } from "@/app/auth";
import Home from "@/app/(portal)/home/home";


export default async function Page() {
    //const session = await auth();

    return (
        <>
            {/*session*/true ? (
                    <Home/>
            ) : (
                <div>Yahan kya krra h lode</div>
            )}
        </>
    );
}
