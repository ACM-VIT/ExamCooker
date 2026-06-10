"use client";

import { registerPlugin } from "@capacitor/core";

export interface NativeAppleSignInResponse {
  response: {
    authorizationCode?: string;
    email?: string;
    familyName?: string;
    givenName?: string;
    identityToken?: string;
    user: string;
  };
}

interface NativeAppleSignInPlugin {
  authorize(options: { scopes?: string }): Promise<NativeAppleSignInResponse>;
}

export const NativeAppleSignIn = registerPlugin<NativeAppleSignInPlugin>(
  "NativeAppleSignIn",
);
