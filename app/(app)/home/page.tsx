import { redirect } from "next/navigation";

export const instant = true;

export default function Page() {
    redirect("/");
}
