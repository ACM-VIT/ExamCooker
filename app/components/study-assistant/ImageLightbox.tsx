"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download } from "lucide-react";

interface ImageLightboxProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt ?? "Image preview"}
            onClick={onClose}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        >
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <a
                    href={src}
                    download
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Download image"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                    <Download className="h-4 w-4" />
                </a>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close preview"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <img
                src={src}
                alt={alt ?? ""}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] max-w-[92vw] cursor-default rounded-lg object-contain shadow-2xl"
            />
        </div>,
        document.body
    );
}
