import React from "react";
import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
    title: "Access blocked",
    robots: { index: false, follow: false },
};

export default function page() {
    return (
        <div className="bg-[#c2e6ec] flex justify-center items-center h-screen">
            <span className="text-2xl font-semibold">Access Blocked</span>
        </div>
    );
}
