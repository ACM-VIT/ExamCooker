"use client";

import { memo, useState } from "react";
import { ToolShell, type ToolState } from "./tool-shell";
import { ToolLoading } from "./tool-loading";
import { ImageLightbox } from "../ImageLightbox";

export interface ImageGenerationOutput {
    result?: string;
}

interface ImageGenerationPartProps {
    state: ToolState;
    output?: ImageGenerationOutput | unknown;
    errorText?: string;
    isGlobalStreaming?: boolean;
}

export const ImageGenerationPart = memo(function ImageGenerationPart({
    state,
    output,
    errorText,
    isGlobalStreaming,
}: ImageGenerationPartProps) {
    const [open, setOpen] = useState(false);

    if (state === "input-streaming" || state === "input-available") {
        return <ToolLoading label="Generating image" active={Boolean(isGlobalStreaming)} />;
    }

    const data = (output as ImageGenerationOutput | null) ?? null;
    const src = data?.result ? toImageDataUrl(data.result) : null;

    return (
        <ToolShell
            toolName="image_generation"
            label="Generated image"
            state={state}
            errorText={errorText}
            defaultOpen
        >
            {src ? (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        aria-label="Open image preview"
                        className="block w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition hover:opacity-95 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                        <img
                            src={src}
                            alt="AI generated image"
                            className="block h-auto w-full cursor-zoom-in object-contain"
                        />
                    </button>
                    {open && (
                        <ImageLightbox
                            src={src}
                            alt="AI generated image"
                            onClose={() => setOpen(false)}
                        />
                    )}
                </>
            ) : (
                <p className="text-[12px] text-black/55 dark:text-[#D5D5D5]/55">
                    This couldn&apos;t be processed as text.
                </p>
            )}
        </ToolShell>
    );
});

function toImageDataUrl(value: string): string {
    if (value.startsWith("data:")) return value;
    return `data:image/webp;base64,${value}`;
}
