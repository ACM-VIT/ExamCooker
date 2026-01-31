"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function RouteGate({
    isAuthed,
    protectedRoutes,
    unprotectedRoutes,
}: {
    isAuthed: boolean;
    protectedRoutes: React.ReactNode;
    unprotectedRoutes: React.ReactNode;
}) {
    const pathname = usePathname();
    const showLanding = pathname === "/";

    return <>{showLanding ? unprotectedRoutes : protectedRoutes}</>;
}
