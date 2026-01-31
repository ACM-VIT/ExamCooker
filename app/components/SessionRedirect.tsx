"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function SessionRedirectInner() {
    const { status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/home");
        }
    }, [status, router]);

    return null;
}

export default function SessionRedirect() {
    return (
        <SessionProvider>
            <SessionRedirectInner />
        </SessionProvider>
    );
}
