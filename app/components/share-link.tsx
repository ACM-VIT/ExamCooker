"use client"
import { faShareNodes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react'
import { captureSharedContent } from "@/lib/posthog/client";
import { shareUrl } from "@/lib/native-share";

type ShareLinkProps = {
    fileType: string;
    resourceTitle?: string;
    resourceKind?: "paper" | "notes";
};

function fallbackShareSubject(fileType: string) {
    return fileType
        .trim()
        .replace(/^this\s+/i, "")
        .replace(/^these\s+/i, "")
        .toLowerCase();
}

const ShareLink = ({
    fileType,
    resourceTitle,
    resourceKind,
}: ShareLinkProps) => {

    const [isVisible, setisVisible] = useState(false);
    const [toastLabel, setToastLabel] = useState("Copied!");

    const handleClick = async () => {
        const url = window.location.href;
        const subject = resourceTitle?.trim() || fallbackShareSubject(fileType);
        const kind = resourceKind ?? fallbackShareSubject(fileType);
        const text = `${subject} ${kind} on ExamCooker:`;
        const shared = await shareUrl({
            title: "ExamCooker study resource",
            text,
            url,
        });

        if (!shared) return;

        setToastLabel("Shared");
        setisVisible(true);
        captureSharedContent({
            contentType: fileType,
            url,
        });
    }

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isVisible) {
            timer = setTimeout(() => {
                setisVisible(false)
            }, 3000)
        }
        return (
            () => clearTimeout(timer)
        );

    }, [isVisible])

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={`Share ${fileType}`}
        >
            <div className="group relative">
                <div className={`
                px-3 py-2 absolute right-0 bottom-0 -translate-y-full
                text-white dark:text-[#232530] text-sm font-medium break-normal 

                bg-gradient-to-b from-[#5fc4e7] to-[#4db3d6] dark:from-[#3BF4C7] dark:to-[#2ad3a7] shadow-lg rounded-md
                transition-all duration-300 ease-in-out
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                `}
                >
                    {toastLabel}
                </div>
            </div>
            <FontAwesomeIcon icon={faShareNodes} />
        </button>
    );
}

export default ShareLink;
