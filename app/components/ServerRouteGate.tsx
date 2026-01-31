import { headers } from "next/headers";

export default async function ServerRouteGate({
    protectedRoutes,
    unprotectedRoutes,
}: {
    protectedRoutes: React.ReactNode;
    unprotectedRoutes: React.ReactNode;
}) {
    const headerList = await headers();
    const rawUrl = headerList.get("x-url");
    let pathname = "/";

    if (rawUrl) {
        try {
            pathname = new URL(rawUrl).pathname;
        } catch {
            pathname = "/";
        }
    }

    const showLanding = pathname === "/";
    return <>{showLanding ? unprotectedRoutes : protectedRoutes}</>;
}
