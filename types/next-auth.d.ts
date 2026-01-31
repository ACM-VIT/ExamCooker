import { DefaultSession } from "next-auth";
import "next-auth";

declare module "next-auth" {
    interface User {
        role?: "USER" | "MODERATOR";
    }

    interface Session {
        user: {
            role?: "USER" | "MODERATOR";
        } & DefaultSession["user"];
    }
}
