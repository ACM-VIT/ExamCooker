
import { signIn } from "@/app/auth"
 
export function SignIn({displayText} : {displayText : string}) {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google")
      }}
    >
      <button type="submit" title="Login with Google" className="bg-[#00B0FF] text-white py-2 px-4 rounded hover:bg-[#007BFF] sm:py-3 sm:px-6">{displayText}</button>
    </form>
  )
} 