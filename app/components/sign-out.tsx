import { signOut } from "@/app/auth";

export function SignOut() {
    return (
        <form
            action={async () => {
                "use server";
                await signOut();
            }}
        >
            <button type="submit">SignOut</button>
        </form>
    );
}
