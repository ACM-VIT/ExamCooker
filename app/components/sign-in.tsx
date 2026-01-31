
import { signIn } from "@/app/auth"

export function SignIn({ displayText }: { displayText: string }) {
    return (
        <form
            action={async () => {
                "use server"
                await signIn("google", { redirectTo: "/home" })
            }}
        >
            <div className="relative group">
                <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                <div className="absolute inset-0 blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                <button type="submit" title="Login With Google" className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                    {displayText}
                </button>
            </div>

        </form>
    )
} 
