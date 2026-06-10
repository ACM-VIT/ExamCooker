"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px), (pointer: coarse)";

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_QUERY);
        const handleChange = () => setIsMobile(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, []);

    return isMobile;
}
