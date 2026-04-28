"use client";

import React, { useEffect, useRef } from "react";
import posthog from "posthog-js";

export default function PostHogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const didInit = useRef(false);

    useEffect(() => {
        if (didInit.current) return;

        const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!apiKey) return;

        posthog.init(apiKey, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
            capture_pageview: false,
            capture_pageleave: true,
            person_profiles: "identified_only",
        });

        didInit.current = true;
    }, []);

    return <>{children}</>;
}
