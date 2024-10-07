"use client"
import { faShareNodes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useState } from 'react'


const IndicatorOfSuccess = () => {
    return (
        <div className="group relative">
            <div
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gradient-to-r from-[#5fc4e7] to-[#4db3d6] dark:from-[#3BF4C7] dark:to-[#2ad3a7] text-white dark:text-[#232530] rounded-md text-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 ease-in-out z-50 whitespace-nowrap shadow-lg backdrop-blur-sm backdrop-filter max-w-xs break-words">
                <span className="font-medium">Copied Link!</span>
                <div
                    className="absolute w-0 h-0 border-t-[6px] border-b-[6px] border-r-[6px] border-transparent border-r-[#5fc4e7] dark:border-r-[#3BF4C7] -left-[6px] top-1/2 -translate-y-1/2 transform transition-transform duration-300 ease-in-out group-hover:scale-110"></div>
            </div>
        </div>
    )
}

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
