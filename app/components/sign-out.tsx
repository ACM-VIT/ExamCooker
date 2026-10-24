"use client";

import React from "react";
import { signOutWithAiSession } from "@/app/components/ai/sign-out-session";
import { toast } from "@/app/components/ui/use-toast";

export function SignOut({ children }: Readonly<{ children: React.ReactNode }>) {
  const handleSignOut = () => {
    void signOutWithAiSession().catch(() => {
      toast({
        title: "Could not sign out",
        description: "Try again to remove your AI key from this browser.",
      });
    });
  };

  return (
    <button type="button" onClick={handleSignOut}>
      {children}
    </button>
  );
}
