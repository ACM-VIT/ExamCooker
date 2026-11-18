"use client";

import { useEffect, useState } from "react";

/** An object URL for `blob`, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!blob) {
            setUrl(null);
            return;
        }
        const nextUrl = URL.createObjectURL(blob);
        setUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [blob]);

    return url;
}
