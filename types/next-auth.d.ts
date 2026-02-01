import type { DefaultSession, DefaultUser } from "@auth/core/types";

declare module "@auth/core/types" {
    interface User extends DefaultUser {
        role?: "USER" | "MODERATOR";
    }

    interface Session extends DefaultSession {
        user?: (DefaultSession["user"] & {
            id?: string;
            role?: "USER" | "MODERATOR";
        });
    }
}
