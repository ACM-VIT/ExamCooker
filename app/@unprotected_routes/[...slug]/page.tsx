import {redirect} from "next/navigation";
import {headers} from "next/headers";

function Page() {
        const header_url = headers().get('x-url') || "";
        return redirect(`/api/auth/init?redirect=${encodeURIComponent(header_url)}`);
}

export default Page;