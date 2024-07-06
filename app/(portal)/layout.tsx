import "@/app/globals.css";
import React from "react";
import { auth } from "@/app/auth";
import { redirect } from "next/navigation";
import ClientSide from "./clientSide";

export default async function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // const session = await auth();
    // if (!session || !session.user) return redirect("/landing");

    return <ClientSide>{children}</ClientSide>;
}
