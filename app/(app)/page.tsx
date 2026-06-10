import type { Metadata } from "next";
import Home from "@/app/(app)/home/home";

export const metadata: Metadata = {
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
};

export default async function Page() {
    return <Home />;
}
