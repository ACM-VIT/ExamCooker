"use client";

import { useEffect, useRef, useState } from "react";

interface ToolLoadingProps {
    label: string;
    active?: boolean;
}

export function ToolLoading({ label, active = true }: ToolLoadingProps) {
    if (!active) return null;

    const canvasRef = useRef<HTMLDivElement | null>(null);
    const [cursorState, setCursorState] = useState({ x: 12, y: 12, rotate: -4 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let interval = 0;
        let timeout = 0;
        let disposed = false;

        const cursorWidth = 14;
        const cursorHeight = 18;

        const moveCursor = () => {
            if (disposed) return;
            const rect = canvas.getBoundingClientRect();
            const maxX = Math.max(12, rect.width - cursorWidth - 12);
            const maxY = Math.max(12, rect.height - cursorHeight - 12);

            setCursorState((prev) => {
                let nextX = prev.x;
                let nextY = prev.y;
                let attempts = 0;

                while (attempts < 8) {
                    nextX = Math.round(Math.random() * maxX);
                    nextY = Math.round(Math.random() * maxY);
                    const dx = nextX - prev.x;
                    const dy = nextY - prev.y;
                    if (Math.hypot(dx, dy) > 48) break;
                    attempts++;
                }

                return {
                    x: nextX,
                    y: nextY,
                    rotate: Math.round((Math.random() * 12 - 6) * 10) / 10,
                };
            });
        };

        timeout = window.setTimeout(() => {
            moveCursor();
            interval = window.setInterval(moveCursor, 500);
        }, 120);

        return () => {
            disposed = true;
            window.clearTimeout(timeout);
            window.clearInterval(interval);
        };
    }, []);

    return (
        <div
            className="study-tool-loader my-2"
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <div className="study-tool-loader__surface">
                <div ref={canvasRef} className="study-tool-loader__canvas" aria-hidden="true">
                    <div
                        className="study-tool-loader__cursor"
                        style={
                            {
                                ["--study-tool-cursor-x" as string]: `${cursorState.x}px`,
                                ["--study-tool-cursor-y" as string]: `${cursorState.y}px`,
                                ["--study-tool-cursor-rotate" as string]: `${cursorState.rotate}deg`,
                            } as React.CSSProperties
                        }
                    />
                </div>
                <p className="study-tool-loader__status">
                    Generating
                    <span className="study-tool-loader__dots" aria-hidden="true">
                        <span className="study-tool-loader__dot" />
                        <span className="study-tool-loader__dot" />
                        <span className="study-tool-loader__dot" />
                    </span>
                </p>
            </div>
        </div>
    );
}
