"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type DoodlePoint = {
    x: number;
    y: number;
};

type DoodleStroke = {
    points: DoodlePoint[];
    color: string;
    size: number;
    updatedAt: number;
};

const DOODLE_COLORS = [
    {
        value: "#6B7DFF",
        swatchClass: "bg-[#6B7DFF]",
        glowClass: "shadow-[0_0_14px_rgba(107,125,255,0.85)]",
    },
    {
        value: "#00E5FF",
        swatchClass: "bg-[#00E5FF]",
        glowClass: "shadow-[0_0_14px_rgba(0,229,255,0.9)]",
    },
    {
        value: "#00FFB7",
        swatchClass: "bg-[#00FFB7]",
        glowClass: "shadow-[0_0_14px_rgba(0,255,183,0.88)]",
    },
    {
        value: "#FF3FAE",
        swatchClass: "bg-[#FF3FAE]",
        glowClass: "shadow-[0_0_14px_rgba(255,63,174,0.88)]",
    },
    {
        value: "#FF9F2D",
        swatchClass: "bg-[#FF9F2D]",
        glowClass: "shadow-[0_0_14px_rgba(255,159,45,0.86)]",
    },
    {
        value: "#B58CFF",
        swatchClass: "bg-[#B58CFF]",
        glowClass: "shadow-[0_0_14px_rgba(181,140,255,0.86)]",
    },
    {
        value: "#FFFFFF",
        swatchClass: "bg-[#FFFFFF]",
        glowClass: "shadow-[0_0_12px_rgba(255,255,255,0.9)]",
    },
];

const STROKE_FADE_DELAY_MS = 400;
const STROKE_FADE_DURATION_MS = 1300;
const ACTIVE_REDRAW_INTERVAL_MS = 16;
const FADE_REDRAW_INTERVAL_MS = 33;
const NEON_MIN_GLOW_BLUR = 4;
const NEON_GLOW_MULTIPLIER = 1.35;
const NEON_CORE_RATIO = 0.22;
const QUALITY_MIN = 0.55;
const QUALITY_RECOVER_STEP = 0.03;
const QUALITY_DROP_STEP = 0.08;
const QUALITY_HIGH_FPS_THRESHOLD = 24;
const QUALITY_LOW_FPS_THRESHOLD = 38;
const AUTO_TRAIL_MIN_DISTANCE_PX = 1.5;
const AUTO_TRAIL_MIN_INTERVAL_MS = 16;
const AUTO_TRAIL_JOIN_WINDOW_MS = 160;
const AUTO_TRAIL_MAX_GAP_PX = 120;
const AUTO_TRAIL_MAX_STROKES = 450;

function isInDoodleUi(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest('[data-doodle-ui="true"]'));
}

export default function DoodleBackdrop() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<DoodleStroke[]>([]);
    const activeTrailStrokeRef = useRef<DoodleStroke | null>(null);
    const lastPointerRef = useRef<DoodlePoint | null>(null);
    const lastTrailAtRef = useRef(0);
    const lastInputAtRef = useRef(0);
    const qualityRef = useRef(1);

    const [doodleEnabled, setDoodleEnabled] = useState(true);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [brushColor, setBrushColor] = useState(DOODLE_COLORS[0].value);
    const [brushSizePercent, setBrushSizePercent] = useState(25);
    const [hasStrokes, setHasStrokes] = useState(false);

    const percentToBrushSize = useCallback((percent: number) => {
        const min = 2;
        const max = 30;
        return min + ((max - min) * percent) / 100;
    }, []);

    const getStrokeOpacity = useCallback((stroke: DoodleStroke, now: number) => {
        const elapsed = now - stroke.updatedAt;
        if (elapsed <= STROKE_FADE_DELAY_MS) {
            return 1;
        }

        const fadeElapsed = elapsed - STROKE_FADE_DELAY_MS;
        if (fadeElapsed >= STROKE_FADE_DURATION_MS) {
            return 0;
        }

        return 1 - fadeElapsed / STROKE_FADE_DURATION_MS;
    }, []);

    const drawStrokeDot = useCallback((ctx: CanvasRenderingContext2D, stroke: DoodleStroke, point: DoodlePoint, opacity: number) => {
        const quality = qualityRef.current;
        const glowBlur =
            quality > 0.58
                ? Math.max(NEON_MIN_GLOW_BLUR * quality, stroke.size * NEON_GLOW_MULTIPLIER * quality) *
                  (0.45 + opacity * 0.55)
                : 0;
        ctx.save();
        ctx.globalAlpha = opacity;
        if (glowBlur > 0) {
            ctx.shadowColor = stroke.color;
            ctx.shadowBlur = glowBlur;
        }
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();

        if (opacity > 0.5 && quality > 0.72) {
            ctx.shadowBlur = 0;
            ctx.globalAlpha = Math.min(1, opacity * 0.9);
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(1, stroke.size * NEON_CORE_RATIO), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }, []);

    const drawStrokeSegment = useCallback(
        (
            ctx: CanvasRenderingContext2D,
            stroke: DoodleStroke,
            fromPoint: DoodlePoint,
            toPoint: DoodlePoint,
            opacity: number,
        ) => {
            const quality = qualityRef.current;
            const glowBlur =
                quality > 0.58
                    ? Math.max(NEON_MIN_GLOW_BLUR * quality, stroke.size * NEON_GLOW_MULTIPLIER * quality) *
                      (0.45 + opacity * 0.55)
                    : 0;
            ctx.save();
            ctx.globalAlpha = opacity;
            if (glowBlur > 0) {
                ctx.shadowColor = stroke.color;
                ctx.shadowBlur = glowBlur;
            }
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(fromPoint.x, fromPoint.y);
            ctx.lineTo(toPoint.x, toPoint.y);
            ctx.stroke();

            if (opacity > 0.45 && quality > 0.72) {
                // A subtle bright core keeps the neon look while staying lightweight.
                ctx.shadowBlur = 0;
                ctx.globalAlpha = Math.min(1, opacity * 0.88);
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = Math.max(1, stroke.size * NEON_CORE_RATIO);
                ctx.beginPath();
                ctx.moveTo(fromPoint.x, fromPoint.y);
                ctx.lineTo(toPoint.x, toPoint.y);
                ctx.stroke();
            }
            ctx.restore();
        },
        [],
    );

    const redrawAllStrokes = useCallback((now = performance.now()) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of strokesRef.current) {
            if (stroke.points.length === 0) continue;
            const opacity = getStrokeOpacity(stroke, now);
            if (opacity <= 0) continue;

            drawStrokeDot(ctx, stroke, stroke.points[0], opacity);
            for (let index = 1; index < stroke.points.length; index += 1) {
                drawStrokeSegment(ctx, stroke, stroke.points[index - 1], stroke.points[index], opacity);
            }
        }
    }, [drawStrokeDot, drawStrokeSegment, getStrokeOpacity]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redrawAllStrokes(performance.now());
    }, [redrawAllStrokes]);

    const clearCanvas = useCallback(() => {
        strokesRef.current = [];
        activeTrailStrokeRef.current = null;
        lastPointerRef.current = null;
        lastTrailAtRef.current = 0;
        lastInputAtRef.current = 0;
        setHasStrokes(false);
        redrawAllStrokes(performance.now());
    }, [redrawAllStrokes]);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    useEffect(() => {
        if (!doodleEnabled) {
            setToolsOpen(false);
        }

        activeTrailStrokeRef.current = null;
        lastPointerRef.current = null;
        lastTrailAtRef.current = 0;
        lastInputAtRef.current = 0;
    }, [doodleEnabled]);

    useEffect(() => {
        if (!toolsOpen) return;

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setToolsOpen(false);
            }
        }

        function handleOutsidePointerDown(event: PointerEvent) {
            if (!isInDoodleUi(event.target)) {
                setToolsOpen(false);
            }
        }

        window.addEventListener("keydown", handleEscape);
        document.addEventListener("pointerdown", handleOutsidePointerDown, { capture: true });

        return () => {
            window.removeEventListener("keydown", handleEscape);
            document.removeEventListener("pointerdown", handleOutsidePointerDown, { capture: true });
        };
    }, [toolsOpen]);

    useEffect(() => {
        if (!hasStrokes) return;

        let frameId = 0;
        let lastRedrawAt = 0;
        let lastFrameAt = 0;

        const tick = (frameTime: number) => {
            if (lastFrameAt !== 0) {
                const frameDelta = frameTime - lastFrameAt;
                if (frameDelta > QUALITY_LOW_FPS_THRESHOLD) {
                    qualityRef.current = Math.max(QUALITY_MIN, qualityRef.current - QUALITY_DROP_STEP);
                } else if (frameDelta < QUALITY_HIGH_FPS_THRESHOLD) {
                    qualityRef.current = Math.min(1, qualityRef.current + QUALITY_RECOVER_STEP);
                }
            }
            lastFrameAt = frameTime;

            const redrawInterval =
                frameTime - lastInputAtRef.current < 140
                    ? ACTIVE_REDRAW_INTERVAL_MS
                    : FADE_REDRAW_INTERVAL_MS;

            if (frameTime - lastRedrawAt < redrawInterval) {
                if (strokesRef.current.length > 0) {
                    frameId = window.requestAnimationFrame(tick);
                }
                return;
            }

            lastRedrawAt = frameTime;
            const now = performance.now();
            const beforeLength = strokesRef.current.length;

            strokesRef.current = strokesRef.current.filter((stroke) => getStrokeOpacity(stroke, now) > 0);

            if (strokesRef.current.length !== beforeLength && strokesRef.current.length === 0) {
                setHasStrokes(false);
            }

            redrawAllStrokes(now);

            if (strokesRef.current.length > 0) {
                frameId = window.requestAnimationFrame(tick);
            }
        };

        frameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [getStrokeOpacity, hasStrokes, redrawAllStrokes]);

    useEffect(() => {
        function resetTrail() {
            activeTrailStrokeRef.current = null;
            lastPointerRef.current = null;
        }

        function pushStroke(stroke: DoodleStroke) {
            const nextLength = strokesRef.current.push(stroke);
            if (nextLength > AUTO_TRAIL_MAX_STROKES) {
                strokesRef.current.splice(0, nextLength - AUTO_TRAIL_MAX_STROKES);
            }

            if (nextLength === 1) {
                setHasStrokes(true);
            }
        }

        function handlePointerMove(event: PointerEvent) {
            if (!doodleEnabled) {
                resetTrail();
                return;
            }

            if (event.pointerType === "touch") {
                return;
            }

            if (isInDoodleUi(event.target)) {
                resetTrail();
                return;
            }

            const now = performance.now();
            lastInputAtRef.current = now;
            const currentPoint: DoodlePoint = { x: event.clientX, y: event.clientY };
            const previousPoint = lastPointerRef.current;
            lastPointerRef.current = currentPoint;

            const brushSize = percentToBrushSize(brushSizePercent);

            if (!previousPoint) {
                const dotStroke: DoodleStroke = {
                    points: [currentPoint],
                    color: brushColor,
                    size: brushSize,
                    updatedAt: now,
                };

                pushStroke(dotStroke);
                activeTrailStrokeRef.current = dotStroke;
                lastTrailAtRef.current = now;
                return;
            }

            const dx = currentPoint.x - previousPoint.x;
            const dy = currentPoint.y - previousPoint.y;
            const distance = Math.hypot(dx, dy);
            if (distance < AUTO_TRAIL_MIN_DISTANCE_PX) {
                return;
            }

            const activeTrailStroke = activeTrailStrokeRef.current;
            const shouldStartNewStroke =
                !activeTrailStroke ||
                now - activeTrailStroke.updatedAt > AUTO_TRAIL_JOIN_WINDOW_MS ||
                distance > AUTO_TRAIL_MAX_GAP_PX;

            if (
                !shouldStartNewStroke &&
                distance < 6 &&
                now - lastTrailAtRef.current < AUTO_TRAIL_MIN_INTERVAL_MS
            ) {
                return;
            }

            if (shouldStartNewStroke) {
                const stroke: DoodleStroke = {
                    points:
                        distance > AUTO_TRAIL_MAX_GAP_PX
                            ? [currentPoint]
                            : [previousPoint, currentPoint],
                    color: brushColor,
                    size: brushSize,
                    updatedAt: now,
                };

                pushStroke(stroke);
                activeTrailStrokeRef.current = stroke;
            } else if (activeTrailStroke) {
                activeTrailStroke.points.push(currentPoint);
                activeTrailStroke.updatedAt = now;
            }

            lastTrailAtRef.current = now;
        }

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerup", resetTrail);
        window.addEventListener("pointercancel", resetTrail);
        window.addEventListener("blur", resetTrail);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", resetTrail);
            window.removeEventListener("pointercancel", resetTrail);
            window.removeEventListener("blur", resetTrail);
        };
    }, [
        brushColor,
        brushSizePercent,
        doodleEnabled,
        percentToBrushSize,
    ]);

    return (
        <>
            <canvas
                ref={canvasRef}
                aria-hidden="true"
                className={`pointer-events-none fixed inset-0 z-[1] h-screen w-screen transition-opacity duration-300 ${doodleEnabled ? "opacity-100" : "opacity-0"}`}
            />

            <div
                data-doodle-ui="true"
                className="absolute right-4 top-20 z-[58] rounded-full border border-black/15 bg-white/90 px-4 py-2 shadow-lg backdrop-blur dark:border-[#D5D5D5]/20 dark:bg-[#0C1222]/90"
            >
                <div className="flex items-center gap-3">
                    <span
                        className={`text-xs font-semibold uppercase tracking-wider ${doodleEnabled
                            ? "text-black/70 dark:text-[#D5D5D5]/70"
                            : "text-[#243EE0] dark:text-[#3BF4C7]"
                            }`}
                    >
                        Doodle
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setDoodleEnabled((value) => {
                                const next = !value;
                                setToolsOpen(next);
                                return next;
                            });
                        }}
                        className={`relative h-8 rounded-full border-2 px-3.5 text-xs font-extrabold uppercase tracking-wide transition-all duration-200 ${doodleEnabled
                            ? "border-[#243EE0] bg-[#243EE0] text-white shadow-[0_6px_16px_rgba(36,62,224,0.28)] dark:border-[#3BF4C7] dark:bg-[#3BF4C7] dark:text-[#0C1222] dark:shadow-[0_6px_16px_rgba(59,244,199,0.25)]"
                            : "border-[#243EE0]/65 bg-white text-[#243EE0] shadow-[0_0_0_3px_rgba(36,62,224,0.18),0_8px_18px_rgba(36,62,224,0.18)] animate-pulse dark:border-[#3BF4C7]/75 dark:bg-[#0C1222] dark:text-[#3BF4C7] dark:shadow-[0_0_0_3px_rgba(59,244,199,0.2),0_8px_18px_rgba(59,244,199,0.14)]"
                            }`}
                    >
                        {!doodleEnabled && (
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-[#243EE0]/20 blur-sm dark:bg-[#3BF4C7]/25"
                            />
                        )}
                        {doodleEnabled ? "On" : "Try"}
                    </button>
                    {doodleEnabled && (
                        <button
                            type="button"
                            onClick={() => setToolsOpen((value) => !value)}
                            className={`h-7 rounded-full border px-3 text-xs font-semibold transition ${toolsOpen
                                ? "border-[#243EE0]/40 bg-[#243EE0]/10 text-[#243EE0] dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]"
                                : "border-black/20 bg-white text-black dark:border-[#D5D5D5]/30 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                                }`}
                        >
                            {toolsOpen ? "Hide Tools" : "Show Tools"}
                        </button>
                    )}
                </div>
            </div>

            {doodleEnabled && toolsOpen && (
                <aside
                    data-doodle-ui="true"
                    className="absolute right-4 top-36 z-[58] w-80 rounded-2xl border border-black/15 bg-white/90 p-4 shadow-2xl backdrop-blur dark:border-[#D5D5D5]/20 dark:bg-[#0C1222]/90"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-black dark:text-[#D5D5D5]">Drawing Tools</h3>
                        <button
                            type="button"
                            onClick={() => setToolsOpen(false)}
                            className="h-7 border border-black/20 px-2 text-xs font-semibold text-black/70 transition hover:bg-black/5 dark:border-[#D5D5D5]/25 dark:text-[#D5D5D5]/80 dark:hover:bg-[#D5D5D5]/10"
                            aria-label="Close drawing tools"
                        >
                            Close
                        </button>
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/70">
                            Color
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {DOODLE_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => {
                                        setBrushColor(color.value);
                                    }}
                                    className={`h-7 w-7 rounded-full border-2 ${brushColor === color.value
                                        ? "border-black dark:border-[#D5D5D5]"
                                        : "border-black/10 dark:border-[#D5D5D5]/20"
                                        }`}
                                    aria-label={`Use color ${color.value}`}
                                >
                                    <span className={`block h-full w-full rounded-full ${color.swatchClass} ${color.glowClass}`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/70">
                            <label htmlFor="doodle-brush-size">Brush Size</label>
                            <span>{brushSizePercent}%</span>
                        </div>
                        <input
                            id="doodle-brush-size"
                            type="range"
                            min={1}
                            max={100}
                            value={brushSizePercent}
                            onChange={(event) => setBrushSizePercent(Number(event.target.value))}
                            className="w-full accent-[#243EE0] dark:accent-[#3BF4C7]"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={clearCanvas}
                            disabled={!hasStrokes}
                            className="h-9 border border-black/20 px-3 text-sm font-semibold text-black/80 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#D5D5D5]/25 dark:text-[#D5D5D5]/85 dark:hover:bg-[#D5D5D5]/10"
                        >
                            Clear Canvas
                        </button>
                    </div>
                </aside>
            )}
        </>
    );
}
