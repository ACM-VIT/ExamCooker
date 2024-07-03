
import { signIn } from "@/app/auth"
 
export function SignIn() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google")
      }}
    >
      <button type="submit" className="bg-[#3BF4C7] hover:bg-[#2AAA8B] text-black font-bold py-2 px-4 rounded shadow-lg">
  Sign in
</button>
    </form>
  )
} 