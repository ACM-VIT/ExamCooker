"use client";

import { useState } from "react";
import { ListVideo, MessageSquareQuote, Layers3 } from "lucide-react";
import type { VinModule } from "@/lib/data/vinTogether";

type ModuleJourneyProps = {
    modules: VinModule[];
};

function formatCount(value: number) {
    return Intl.NumberFormat("en-IN").format(value);
}

function moduleAnchor(module: VinModule) {
    return `module-${module.slug || module.id}`;
}

export default function ModuleJourney({ modules }: ModuleJourneyProps) {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    if (modules.length === 0) return null;

    const NODE_R = 22;
    const ROW_H = 130;
    const LEFT_X = 60;
    const RIGHT_X = 180;
    const SVG_W = RIGHT_X + NODE_R + 20;

    const points = modules.map((_, i) => ({
        x: i % 2 === 0 ? LEFT_X : RIGHT_X,
        y: 36 + i * ROW_H,
    }));

    const svgH = points[points.length - 1].y + 36;

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const cur = points[i];
        const midY = (prev.y + cur.y) / 2;
        pathD += ` C ${prev.x} ${midY}, ${cur.x} ${midY}, ${cur.x} ${cur.y}`;
    }

    return (
        <section className="mx-auto max-w-7xl px-3 pt-8 pb-4 sm:px-6 lg:px-10">
            <h2 className="text-lg font-bold uppercase tracking-wider text-black dark:text-[#D5D5D5] sm:text-xl mb-6">
                Your learning path
            </h2>

            <div className="relative" style={{ minHeight: svgH }}>
                <svg
                    className="absolute left-0 top-0 pointer-events-none"
                    width={SVG_W}
                    height={svgH}
                    fill="none"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id="jp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5FC4E7" />
                            <stop offset="100%" stopColor="#3BF4C7" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="6" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Thick background path */}
                    <path d={pathD} stroke="#5FC4E7" strokeWidth="6" strokeLinecap="round" opacity="0.25" className="dark:opacity-15" />
                    {/* Dashed foreground */}
                    <path d={pathD} stroke="url(#jp)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 7" />

                    {points.map((pt, i) => {
                        const active = hoveredIdx === i;
                        return (
                            <g key={modules[i].id}>
                                {/* Outer glow ring on hover */}
                                {active && (
                                    <circle cx={pt.x} cy={pt.y} r={NODE_R + 6} fill="#5FC4E7" opacity="0.25" filter="url(#glow)" className="dark:fill-[#3BF4C7]" />
                                )}
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={NODE_R}
                                    className={`transition-all duration-200 ${
                                        active
                                            ? "fill-[#5FC4E7] stroke-[#5FC4E7] dark:fill-[#3BF4C7]/30 dark:stroke-[#3BF4C7]"
                                            : "fill-white stroke-[#5FC4E7] dark:fill-[#0C1222] dark:stroke-[#3BF4C7]/50"
                                    }`}
                                    strokeWidth="3"
                                />
                                <text
                                    x={pt.x}
                                    y={pt.y + 1}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize="13"
                                    fontWeight="900"
                                    className={`select-none transition-all ${
                                        active
                                            ? "fill-white dark:fill-[#3BF4C7]"
                                            : "fill-black/60 dark:fill-[#D5D5D5]/70"
                                    }`}
                                >
                                    {i + 1}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* Cards beside each node */}
                {modules.map((module, i) => {
                    const pt = points[i];
                    const totalVideos = module.counts.videoCount + module.counts.exampleVideoCount;
                    const active = hoveredIdx === i;
                    const cardLeft = SVG_W + 8;

                    return (
                        <a
                            key={module.id}
                            href={`#${moduleAnchor(module)}`}
                            className="group absolute block"
                            style={{
                                top: pt.y - 40,
                                left: cardLeft,
                                width: `calc(100% - ${cardLeft + 8}px)`,
                                maxWidth: 560,
                            }}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            <div
                                className={`flex flex-col gap-1.5 border-2 px-4 py-3 transition-all duration-200 ${
                                    active
                                        ? "border-[#5FC4E7] bg-[#5FC4E7]/30 shadow-lg scale-[1.02] dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/10"
                                        : "border-[#5FC4E7]/50 bg-[#5FC4E7]/15 dark:border-[#ffffff]/15 dark:bg-[#ffffff]/[0.04]"
                                }`}
                            >
                                <h3 className="text-sm font-bold leading-snug text-black dark:text-[#D5D5D5] sm:text-base">
                                    {module.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-black/55 dark:text-[#D5D5D5]/50">
                                    <span className="inline-flex items-center gap-1">
                                        <Layers3 className="h-3 w-3" />
                                        {formatCount(module.counts.topicCount)} topics
                                    </span>
                                    {totalVideos > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            <ListVideo className="h-3 w-3" />
                                            {formatCount(totalVideos)} videos
                                        </span>
                                    )}
                                    {module.counts.questionCount > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            <MessageSquareQuote className="h-3 w-3" />
                                            {formatCount(module.counts.questionCount)} Qs
                                        </span>
                                    )}
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
