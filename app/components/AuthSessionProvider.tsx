"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function AuthSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
