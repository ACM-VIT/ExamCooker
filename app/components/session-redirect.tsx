import { redirect } from "next/navigation";
import { auth } from "@/app/auth";

export default async function SessionRedirect() {
    const session = await auth();

    if (session?.user) {
        redirect("/");
    }

    return null;
}
