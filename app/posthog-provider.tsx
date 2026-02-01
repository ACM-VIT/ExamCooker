"use client";

import React from "react";
import { PostHogProvider as PHProvider } from "@posthog/react";
import posthog from "posthog-js";

export default function PostHogProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return <PHProvider client={posthog}>{children}</PHProvider>;
}
