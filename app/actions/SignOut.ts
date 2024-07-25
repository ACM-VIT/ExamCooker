"use server";
import { signOut } from "@/app/auth";

export const signOutAction = async () => {
    await signOut();
};
