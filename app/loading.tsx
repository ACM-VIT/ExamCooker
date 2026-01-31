"use client";
import LoadingSvg from "@/public/assets/Loader.svg"
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function getQuirkyLine() {
    const lines = [
        "Brewing up something amazing for you...",
        "Grinding away at loading your content...",
        "Loading up the next serving of coffee...",
        "Adding a shot of speed to your load...",
        "Avoiding work by loading things...",
        "Brewing up a page just for you...",
        "Procrastinating by making you wait for this load...",
    ]


    return lines[Math.floor(Math.random() * lines.length)];
}

export default function Loading() {
    const pathname = usePathname();
    const [line, setLine] = useState("Loading...");

    useEffect(() => {
        setLine(getQuirkyLine());
    }, []);

    if (pathname === "/") {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 50,
                color: 'white',
            }}
        >
            <div className="flex flex-col justify-center items-center">
                <Image src={LoadingSvg} alt="Loader" className="animate-spin size-1/3" />
                <h6 className="p-5">{line}</h6>
            </div>
        </div>
    );
}
