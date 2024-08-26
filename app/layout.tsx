import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";

export const metadata = {
    title: {
        template: '%s | ExamCooker',
        default: 'ExamCooker - ACM-VIT',
    },
    description: "Cram up for your exams with ExamCooker!",
    keywords: ['vit', 'previous year question papers', 'pdf', 'notes', 'question papers', 'exam', 'examcooker', 'acm', 'vit acm', 'vit acm examcooker'],
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
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
