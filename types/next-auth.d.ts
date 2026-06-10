import type { DefaultSession } from "next-auth";

type AppRole = "USER" | "MODERATOR";

declare module "next-auth" {
    interface Session {
        user: (DefaultSession["user"] & {
            id: string;
            role?: AppRole;
        });
    }

    interface User {
        role?: AppRole;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        role?: AppRole;
        roleSyncedAt?: number;
    }
}
