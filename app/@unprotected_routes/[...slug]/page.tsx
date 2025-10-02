import {redirect} from "next/navigation";
import {headers} from "next/headers";

async function Page() {
        const headersList = await headers();
        const header_url = headersList.get('x-url') || "";
        return redirect(`/api/auth/init?redirect=${encodeURIComponent(header_url)}`);
}

export default Page;