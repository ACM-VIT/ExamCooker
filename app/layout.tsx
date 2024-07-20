import React from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { getBookmarks } from './actions/bookmarks';
import BookmarksProvider from './components/BookmarksProvider';

export const metadata = {
    title: "ExamCooker 2024",
    description: "ACM-VIT 2024 ExamCooker Website",
};

const plus_jakarta_sans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const initialBookmarks = await getBookmarks();

    return (
        <html lang="en">
            <body className={`${plus_jakarta_sans.className} antialiased bg-[#C2E6EC] dark:bg-[#0C1222]`} style={{ margin: "0" }}>
                <SessionProvider>
                    <BookmarksProvider initialBookmarks={initialBookmarks}>
                        {children}
                    </BookmarksProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
