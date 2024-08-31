import { auth } from "@/app/auth";
import Home from "@/app/@protected_routes/home/home";

export default async function Page() {
    const session = await auth();

    return <>{session ? <Home /> : <div>Yahan kya krra h lode</div>}</>;
}
