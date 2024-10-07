"use client"
import { faShareNodes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react'

const ShareLink = ({fileType} : {fileType:string}) => {

    const [isVisible, setisVisible] = useState(false);

    const copyToClipboard = () => {
        const msg: string = `Dude! Checkout ${fileType}! ${location.href}`;
        navigator.clipboard.writeText(msg);
    }

    const handleClick = () => {
        setisVisible(true);
        copyToClipboard();
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
        <button onClick={handleClick}>
            <div className="group relative block md:hidden">
                <div className={`
                px-3 py-2 absolute right-0 bottom-0 -translate-y-full
                text-white dark:text-[#232530] text-sm font-medium 

                bg-gradient-to-b from-[#5fc4e7] to-[#4db3d6] dark:from-[#3BF4C7] dark:to-[#2ad3a7] shadow-lg rounded-md
                transition-all duration-300 ease-in-out
                ${isVisible ? 'opacity-100 -translate-y-0' : 'opacity-0 translate-y-1'}
                `}
                >
                    Copied!
                </div>
            </div>
            <FontAwesomeIcon icon={faShareNodes} />
            <div className="group relative hidden md:block">
                <div className={`
                px-3 py-2 absolute right-0 translate-x-1/2 
                text-white dark:text-[#232530] text-sm font-medium 

                bg-gradient-to-b from-[#5fc4e7] to-[#4db3d6] dark:from-[#3BF4C7] dark:to-[#2ad3a7] shadow-lg rounded-md
                transition-all duration-300 ease-in-out
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
                `}
                >
                    Copied!
                </div>
            </div>
        </button>
    );
}

export default ShareLink;
