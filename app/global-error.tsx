"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "examcooker:chunk-reload";

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to load chunk/i.test(message) ||
    /Loading CSS chunk/i.test(message)
  );
}

export default function GlobalError({
  error,
  reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        if (!isChunkLoadError(error)) return;
        // After a deploy, content-hashed chunk filenames change and the old
        // chunks are removed from the server, so a client holding stale HTML
        // requests chunk URLs that 404 and `next/dynamic` throws. Force a
        // one-time reload to pull a fresh HTML document and current chunks.
        let alreadyReloaded = false;
        try {
            alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG) === "1";
            window.sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch {
            // sessionStorage may be unavailable (private mode); fall through.
        }

        if (!alreadyReloaded) {
            window.location.reload();
        }
    }, [error]);

    useEffect(() => {
        if (isChunkLoadError(error)) return;
        try {
            window.sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
            // Ignore storage access errors.
        }
    }, [error]);

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
                            try {
                                window.sessionStorage.removeItem(RELOAD_FLAG);
                            } catch {
                                // Ignore storage access errors.
                            }
                            reset();
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
