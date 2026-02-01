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

declare module "@auth/core/types" {
    interface User {
        role?: AppRole;
    }

    interface Session {
        user?: (DefaultSession["user"] & {
            id?: string;
            role?: AppRole;
        });
    }
}
