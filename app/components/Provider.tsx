"use client";

import React, { useEffect } from 'react';
import { SessionProvider } from "next-auth/react";
import { initializeFavorites } from '../actions/initializeFavourites';

export function ClientProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        initializeFavorites();
    }, []);

    return <SessionProvider>{children}</SessionProvider>;
}
