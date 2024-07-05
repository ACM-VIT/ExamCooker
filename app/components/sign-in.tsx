
import { signIn } from "@/app/auth"

export function SignIn({ displayText }: { displayText: string }) {
    return (
        <form
            action={async () => {
                "use server"
                await signIn("google")
            }}
        >
            <div className="relative group">
                <div className="absolute inset-0 bg-black">
                </div>
                <button type="submit" title="Login With Google "className="border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                    {displayText}
                </button>
            </div>

        </form>
    )
} 
