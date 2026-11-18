"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faXmark } from "@fortawesome/free-solid-svg-icons";
import { isNativeCameraAvailable, takeNativePhoto } from "@/lib/native-camera";
import { useObjectUrl } from "@/app/components/upload/use-object-url";

// "native": the iOS/Android app's camera, one photo per call.
// "stream": an in-page preview from getUserMedia with a shutter button.
// "fallback": the browser's own camera through a capture file input.
type ScanMode = "starting" | "native" | "stream" | "fallback";

type Shot = { id: string; file: File };

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
    audio: false,
    video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
    },
};
const FRAME_QUALITY = 0.92;

function describeCameraError(error: unknown) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
        return "Camera access was blocked.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "No camera was found.";
    }
    if (name === "NotReadableError") {
        return "The camera is in use by another app.";
    }
    return "The camera preview couldn't start.";
}

function captureVideoFrame(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return Promise.resolve(null);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<File | null>((resolve) => {
        canvas.toBlob(
            (blob) => {
                canvas.width = 0;
                canvas.height = 0;
                resolve(blob
                    ? new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
                    : null);
            },
            "image/jpeg",
            FRAME_QUALITY,
        );
    });
}

function ShotThumbnail({
    index,
    onRemove,
    shot,
}: {
    index: number;
    onRemove: (id: string) => void;
    shot: Shot;
}) {
    const url = useObjectUrl(shot.file);
    return (
        <li className="relative shrink-0">
            {url ? (
                <img
                    src={url}
                    alt={`Captured page ${index + 1}`}
                    className="h-20 w-16 object-cover ring-1 ring-white/30"
                />
            ) : (
                <div className="h-20 w-16 bg-white/10 ring-1 ring-white/30" />
            )}
            <span className="absolute bottom-0 left-0 bg-black/75 px-1 text-[11px] font-bold">
                {index + 1}
            </span>
            <button
                type="button"
                onClick={() => onRemove(shot.id)}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-black bg-white text-xs text-black"
                aria-label={`Remove captured page ${index + 1}`}
            >
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </li>
    );
}

/**
 * A full-screen, multi-shot camera: take several pages in a row, then keep
 * them with Done or discard them with Cancel. The camera stream stops when
 * the dialog closes, unmounts, or the route is hidden.
 */
export default function ScanPagesDialog({
    maxPages,
    onCancel,
    onDone,
}: {
    maxPages: number;
    onCancel: () => void;
    onDone: (files: File[]) => void;
}) {
    const [mode, setMode] = useState<ScanMode>("starting");
    const [notice, setNotice] = useState("");
    const [shots, setShots] = useState<Shot[]>([]);
    const [busy, setBusy] = useState(false);
    const [streamReady, setStreamReady] = useState(false);
    const [streamAttempt, setStreamAttempt] = useState(0);
    const [flash, setFlash] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fallbackInputRef = useRef<HTMLInputElement | null>(null);
    const primaryRef = useRef<HTMLButtonElement | null>(null);
    const nativeStartedRef = useRef(false);
    const nextShotIdRef = useRef(0);
    const shotsRef = useRef<Shot[]>([]);
    const titleId = useId();

    const pageLimitReached = shots.length >= maxPages;
    const nextPageNumber = Math.min(shots.length + 1, maxPages);

    const addShots = useCallback((files: File[]) => {
        setShots((current) => [
            ...current,
            ...files.slice(0, Math.max(0, maxPages - current.length)).map((file) => ({
                id: `shot-${++nextShotIdRef.current}`,
                file,
            })),
        ]);
    }, [maxPages]);

    useEffect(() => {
        shotsRef.current = shots;
    }, [shots]);

    const removeShot = useCallback((id: string) => {
        setShots((current) => current.filter((shot) => shot.id !== id));
    }, []);

    const finish = useCallback(() => {
        if (shots.length === 0) onCancel();
        else onDone(shots.map((shot) => shot.file));
    }, [onCancel, onDone, shots]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const native = await isNativeCameraAvailable().catch(() => false);
            if (cancelled) return;
            if (native) {
                setMode("native");
            } else if (typeof navigator.mediaDevices?.getUserMedia === "function") {
                setMode("stream");
            } else {
                setNotice("This browser can't show a camera preview.");
                setMode("fallback");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (mode !== "stream") return;
        let cancelled = false;
        let stream: MediaStream | null = null;
        const video = videoRef.current;

        const stop = () => {
            stream?.getTracks().forEach((track) => track.stop());
            stream = null;
            if (video) video.srcObject = null;
            setStreamReady(false);
        };
        // A page restored from the back/forward cache needs a new stream.
        const restart = (event: PageTransitionEvent) => {
            if (event.persisted) setStreamAttempt((attempt) => attempt + 1);
        };

        navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).then(
            (nextStream) => {
                if (cancelled) {
                    nextStream.getTracks().forEach((track) => track.stop());
                    return;
                }
                stream = nextStream;
                if (!video) return;
                video.srcObject = nextStream;
                void video.play().catch(() => undefined);
            },
            (error: unknown) => {
                if (cancelled) return;
                setNotice(describeCameraError(error));
                setMode("fallback");
            },
        );
        window.addEventListener("pagehide", stop);
        window.addEventListener("pageshow", restart);
        return () => {
            cancelled = true;
            window.removeEventListener("pagehide", stop);
            window.removeEventListener("pageshow", restart);
            stop();
        };
    }, [mode, streamAttempt]);

    const takeNative = useCallback(async () => {
        setBusy(true);
        try {
            const photo = await takeNativePhoto();
            if (photo) addShots([photo]);
            return photo;
        } catch (error) {
            console.error("Native camera failed:", error);
            setNotice("The camera couldn't start.");
            setMode("fallback");
            return null;
        } finally {
            setBusy(false);
        }
    }, [addShots]);

    // Open the native camera straight away; closing it before the first page
    // leaves the flow.
    useEffect(() => {
        if (mode !== "native" || nativeStartedRef.current) return;
        nativeStartedRef.current = true;
        void takeNative().then((photo) => {
            if (!photo && shotsRef.current.length === 0) onCancel();
        });
    }, [mode, onCancel, takeNative]);

    const shutter = useCallback(async () => {
        if (busy || pageLimitReached) return;
        if (mode === "native") {
            await takeNative();
            return;
        }
        if (mode === "fallback") {
            fallbackInputRef.current?.click();
            return;
        }
        const video = videoRef.current;
        if (mode !== "stream" || !video?.videoWidth) return;
        setBusy(true);
        setFlash(true);
        window.setTimeout(() => setFlash(false), 120);
        try {
            const frame = await captureVideoFrame(video);
            if (frame) addShots([frame]);
        } finally {
            setBusy(false);
        }
    }, [addShots, busy, mode, pageLimitReached, takeNative]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busy) {
                event.preventDefault();
                onCancel();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [busy, onCancel]);

    useEffect(() => {
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = overflow;
        };
    }, []);

    useEffect(() => {
        if (mode !== "starting") primaryRef.current?.focus();
    }, [mode]);

    const shutterLabel = pageLimitReached
        ? "Page limit reached"
        : shots.length === 0
            ? `Take page ${nextPageNumber}`
            : mode === "stream"
                ? `Take page ${nextPageNumber}`
                : "Take next page";

    const dialog = (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
        >
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy && mode === "native"}
                    className="h-10 border-2 border-white/70 px-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                >
                    Cancel
                </button>
                <div className="min-w-0 text-center">
                    <h2 id={titleId} className="text-base font-bold">Scan pages</h2>
                    <p className="text-xs text-white/70" aria-live="polite">
                        {shots.length === 1 ? "1 page" : `${shots.length} pages`} taken
                    </p>
                </div>
                <button
                    type="button"
                    onClick={finish}
                    disabled={shots.length === 0 || busy}
                    className="h-10 border-2 border-black bg-[#3BF4C7] px-3 text-sm font-bold text-black disabled:opacity-50"
                >
                    Done
                </button>
            </div>

            <div className="relative min-h-0 flex-1 bg-black">
                {mode === "stream" ? (
                    <>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            aria-label="Camera preview"
                            onLoadedMetadata={() => setStreamReady(true)}
                            className="size-full object-contain"
                        />
                        {!streamReady ? (
                            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                                Starting camera...
                            </p>
                        ) : null}
                        <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-100 ${flash ? "opacity-70" : "opacity-0"}`}
                        />
                    </>
                ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <FontAwesomeIcon icon={faCamera} className="text-4xl text-[#3BF4C7]" />
                        {mode === "starting" ? (
                            <p className="text-sm text-white/70">Starting camera...</p>
                        ) : mode === "native" ? (
                            <p className="max-w-xs text-sm text-white/80">
                                {busy ? "Camera open..." : "Take the next page, or tap Done when every page is in."}
                            </p>
                        ) : (
                            <p className="max-w-xs text-sm text-white/80">
                                {notice ? `${notice} ` : ""}Take each page with your camera, then tap Done.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="border-t border-white/15 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
                {shots.length > 0 ? (
                    <ol className="mb-3 flex gap-3 overflow-x-auto pb-1 pr-2 pt-2" aria-label="Captured pages">
                        {shots.map((shot, index) => (
                            <ShotThumbnail key={shot.id} shot={shot} index={index} onRemove={removeShot} />
                        ))}
                    </ol>
                ) : (
                    <p className="mb-3 text-center text-xs text-white/60">Captured pages appear here.</p>
                )}

                <div className="flex justify-center">
                    {mode === "stream" ? (
                        <button
                            ref={primaryRef}
                            type="button"
                            onClick={() => void shutter()}
                            disabled={!streamReady || busy || pageLimitReached}
                            aria-label={shutterLabel}
                            className="size-16 rounded-full border-4 border-white bg-white/85 shadow-[0_0_0_3px_#000_inset] transition-transform active:scale-95 disabled:opacity-40"
                        />
                    ) : (
                        <button
                            ref={primaryRef}
                            type="button"
                            onClick={() => void shutter()}
                            disabled={mode === "starting" || busy || pageLimitReached}
                            className="inline-flex h-12 items-center gap-2 border-2 border-white bg-white px-5 text-sm font-bold text-black disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faCamera} />
                            {shutterLabel}
                        </button>
                    )}
                </div>
            </div>

            {mode === "fallback" ? (
                <input
                    ref={fallbackInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    aria-label="Take a page photo"
                    onChange={(event) => {
                        if (event.target.files) addShots(Array.from(event.target.files));
                        event.target.value = "";
                    }}
                />
            ) : null}
        </div>
    );

    return createPortal(dialog, document.body);
}
