"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, PencilLine, StopCircle, X } from "lucide-react";

interface StudyComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    onCancelEdit?: () => void;
    isStreaming?: boolean;
    isEditing?: boolean;
    placeholder?: string;
    disabled?: boolean;
    variant?: "inline" | "sticky";
}

const MAX_HEIGHT = 200;

export function StudyComposer({
    value,
    onChange,
    onSend,
    onStop,
    onCancelEdit,
    isStreaming,
    isEditing,
    placeholder,
    disabled,
    variant = "sticky",
}: StudyComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + "px";
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (value.trim()) onSend();
        }
    };

    const isInline = variant === "inline";

    const wrapper = (
        <div className="relative mx-auto w-full max-w-3xl">
            <div className="relative rounded-[1.4rem] border border-black/10 bg-white shadow-[0_10px_28px_-22px_rgba(12,18,34,0.28)] transition focus-within:border-[#4db3d6] dark:border-white/10 dark:bg-[#111826] dark:shadow-[0_12px_30px_-22px_rgba(0,0,0,0.52)] dark:focus-within:border-[#4db3d6]">
                {isEditing && (
                    <div className="flex items-center justify-between gap-3 border-b border-black/6 px-3.5 py-2 text-[12px] text-black/60 dark:border-white/8 dark:text-[#D5D5D5]/60 sm:px-4">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                            <PencilLine className="h-3.5 w-3.5" />
                            Editing prompt
                        </span>
                        <button
                            type="button"
                            onClick={onCancelEdit}
                            className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-1 text-[11px] font-medium text-black/65 transition hover:border-black/20 hover:text-black dark:border-white/10 dark:text-[#D5D5D5]/65 dark:hover:border-white/20 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="h-3 w-3" />
                            Cancel
                        </button>
                    </div>
                )}
                <div className="flex items-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder ?? "Ask anything…"}
                        disabled={disabled}
                        rows={1}
                        style={{ maxHeight: MAX_HEIGHT }}
                        className="min-h-[44px] flex-1 resize-none bg-transparent py-1 text-[15px] leading-relaxed text-black placeholder:text-black/40 focus:outline-none dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/40"
                    />
                    {isStreaming ? (
                        <button
                            type="button"
                            onClick={onStop}
                            aria-label="Stop generating"
                            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0C1222] text-white transition hover:brightness-110 active:scale-95 dark:bg-[#D5D5D5] dark:text-[#0C1222]"
                        >
                            <StopCircle className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => value.trim() && onSend()}
                            disabled={!value.trim() || disabled}
                            aria-label="Send"
                            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4db3d6] text-white transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/40 dark:bg-[#3BF4C7] dark:text-[#0C1222] dark:disabled:bg-white/10 dark:disabled:text-white/40"
                        >
                            <ArrowUp className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    if (isInline) {
        return <div className="w-full">{wrapper}</div>;
    }

    return (
        <div className="sticky bottom-0 z-10 border-t border-black/6 bg-[#C2E6EC]/94 px-3 pb-3 pt-3 backdrop-blur-sm dark:border-white/8 dark:bg-[#0C1222]/94 sm:px-6 sm:pb-4 sm:pt-4">
            {wrapper}
        </div>
    );
}
