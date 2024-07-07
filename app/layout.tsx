import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";


export const metadata = {
    title: "ExamCooker 2024",
    description: "ACM-VIT 2024 ExamCooker Website",
    // metadataBase: new URL(""),
};
const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {


    return (
        <html lang="en" >
            <body className={`${plus_jakarta_sans.className} antialiased bg-[#ccf3ff]`} style={{ margin: "0" }}>
                <SessionProvider>
                    {children}
                </SessionProvider>
            </body>
        </html>
    );
}
