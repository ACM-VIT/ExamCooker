"use client";

import { useEffect } from "react";
import {
  claimChunkReload,
  clearReloadGuard,
  getChunkErrorKey,
  isChunkLoadError,
} from "./global-error-reload-guard";

type GlobalErrorProps = {
    error: Error & { digest?: string };
    unstable_retry?: () => void;
    reset?: () => void;
};

export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: GlobalErrorProps) {
    const retry = unstable_retry ?? reset;
    const isChunkError = isChunkLoadError(error);

    useEffect(() => {
        if (!isChunkError) return;
        // After a deploy, content-hashed chunk filenames change and the old
        // chunks are removed from the server, so a client holding stale HTML
        // requests chunk URLs that 404 and `next/dynamic` throws. Force a
        // guarded reload to pull a fresh HTML document and current chunks.
        if (claimChunkReload(getChunkErrorKey(error))) {
            window.location.reload();
        }
    }, [error, isChunkError]);

    useEffect(() => {
        if (isChunkError) return;
        clearReloadGuard();
    }, [isChunkError]);

    return (
        <html lang="en" className="dark">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0C1222",
                    color: "#E6EDF6",
                    fontFamily:
                        "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    padding: "24px",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "28rem" }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                        Something went wrong
                    </h1>
                    <p style={{ opacity: 0.8, marginBottom: "1.5rem", lineHeight: 1.5 }}>
                        We hit an unexpected error while loading this page. Reloading usually
                        fixes it.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            clearReloadGuard();
                            if (isChunkError) {
                                window.location.reload();
                                return;
                            }
                            if (retry) {
                                retry();
                                return;
                            }
                            window.location.reload();
                        }}
                        style={{
                            cursor: "pointer",
                            borderRadius: "9999px",
                            border: "none",
                            padding: "0.625rem 1.5rem",
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            backgroundColor: "#C2E6EC",
                            color: "#0C1222",
                        }}
                    >
                        Reload
                    </button>
                </div>
            </body>
        </html>
    );
}
