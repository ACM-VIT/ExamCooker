import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";

export const metadata = {
    title: "ExamCooker 2024",
    description: "ACM-VIT 2024 ExamCooker Website",
    metadataBase: new URL("https://exam-cooker.acmvit.in/"),
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <html lang="en">
            <body
                className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`}
                style={{ margin: "0" }}
            >
                        {children}
                <Toaster />
            </body>
        </html>
    );
}
