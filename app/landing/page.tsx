import React from "react";
import LandingPageContent from "@/app/components/landing_page/landing";
import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import "@/app/globals.css";

async function Page() {
    const session = await auth();
    if (session) return redirect("/");
    return (
        <div className="min-h-screen bg-[#5fc4e7] flex flex-col">
            <LandingPageContent />
        </div>
    );
}

export default Page;
