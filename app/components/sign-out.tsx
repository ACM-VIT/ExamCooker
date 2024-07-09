import { signOutAction } from "../actions/SignOut";

export function SignOut({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <form action={signOutAction}>
            <button>{children}</button>
        </form>
    );
}
