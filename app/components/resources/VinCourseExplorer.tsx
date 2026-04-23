"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown,
    ExternalLink,
    FileText,
    ImageIcon,
    Layers3,
    ListVideo,
    MessageSquareQuote,
} from "lucide-react";
import AppImage from "@/app/components/common/AppImage";
import SearchIcon from "@/app/components/assets/seacrh.svg";
import type { VinCourse, VinModule, VinRichItem, VinSubtopic } from "@/lib/data/vinTogether";

type VinCourseExplorerProps = {
    course: VinCourse;
    sourceOrigin: string;
};

function formatCount(value: number) {
    return Intl.NumberFormat("en-IN").format(value);
}

function getTopicRemoteUrl(sourceOrigin: string, topic: VinSubtopic) {
    return `${sourceOrigin}${topic.remotePath}`;
}

function getYouTubeVideoId(url: string) {
    const match = url.match(
        /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^?&/]+)/i,
    );
    return match?.[1] ?? null;
}

function getYouTubeWatchUrl(url: string) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
}

function getYouTubeThumbnail(url: string) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

function normalizeSearch(value: string) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function matchesRichItems(items: VinRichItem[], query: string) {
    return items.some((item) => normalizeSearch(item.text ?? "").includes(query));
}

function moduleAnchor(module: VinModule) {
    return `module-${module.slug || module.id}`;
}

function VideoTile({
    url,
    index,
    label,
}: {
    url: string;
    index: number;
    label: string;
}) {
    const thumbnail = getYouTubeThumbnail(url);
    const href = getYouTubeWatchUrl(url);

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group/video overflow-hidden border-2 border-[#5FC4E7] bg-white transition hover:scale-[1.02] hover:shadow-lg dark:border-[#ffffff]/20 dark:bg-[#0C1222]"
        >
            <div className="relative aspect-[16/9] bg-[#0d1320]">
                {thumbnail ? (
                    <AppImage
                        src={thumbnail}
                        alt={label}
                        fill
                        className="object-cover"
                    />
                ) : null}
                <div className="absolute inset-0 bg-black/30 transition group-hover/video:bg-black/20" />
                <div className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 bg-black/50 px-2.5 text-xs font-bold text-white backdrop-blur-sm">
                    <ListVideo className="h-3.5 w-3.5" />
                    {label} {index + 1}
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-black dark:text-[#D5D5D5]">
                <span>Watch on YouTube</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-black/40 dark:text-[#D5D5D5]/40" />
            </div>
        </a>
    );
}

function RichItemBlock({
    item,
    index,
}: {
    item: VinRichItem;
    index: number;
}) {
    return (
        <div className="flex gap-3 py-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-[11px] font-bold text-black/50 dark:bg-[#D5D5D5]/10 dark:text-[#D5D5D5]/50">
                {index + 1}
            </span>
            <div className="min-w-0 flex-1">
                {item.text ? (
                    <p className="text-sm leading-relaxed text-black/80 dark:text-[#D5D5D5]/85">
                        {item.text}
                    </p>
                ) : null}
                {item.image ? (
                    <div className="relative mt-3 overflow-hidden border border-black/10 bg-white dark:border-[#D5D5D5]/10 dark:bg-black">
                        <AppImage
                            src={item.image}
                            alt={`Visual ${index + 1}`}
                            width={1200}
                            height={800}
                            className="h-auto w-full object-contain"
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function VinCourseExplorer({
    course,
    sourceOrigin,
}: VinCourseExplorerProps) {
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const firstTopic = course.modules[0]?.subtopics[0]?.id;
        return firstTopic ? { [firstTopic]: true } : {};
    });

    const filteredModules = useMemo(() => {
        const normalizedQuery = normalizeSearch(query);

        if (!normalizedQuery) {
            return course.modules;
        }

        return course.modules
            .map((module) => {
                const matchingSubtopics = module.subtopics.filter((topic) => {
                    return (
                        normalizeSearch(module.title).includes(normalizedQuery) ||
                        normalizeSearch(topic.name).includes(normalizedQuery) ||
                        normalizeSearch(topic.title).includes(normalizedQuery) ||
                        matchesRichItems(topic.takeaways, normalizedQuery) ||
                        matchesRichItems(topic.questions, normalizedQuery)
                    );
                });

                return {
                    ...module,
                    subtopics: matchingSubtopics,
                    counts: matchingSubtopics.reduce(
                        (totals, topic) => {
                            totals.topicCount += 1;
                            totals.videoCount += topic.counts.videoCount;
                            totals.exampleVideoCount += topic.counts.exampleVideoCount;
                            totals.takeawayCount += topic.counts.takeawayCount;
                            totals.questionCount += topic.counts.questionCount;
                            totals.assetCount += topic.counts.assetCount;
                            if (topic.pdfLink) totals.resourceCount += 1;
                            return totals;
                        },
                        {
                            topicCount: 0,
                            videoCount: 0,
                            exampleVideoCount: 0,
                            takeawayCount: 0,
                            questionCount: 0,
                            assetCount: 0,
                            resourceCount: 0,
                        },
                    ),
                };
            })
            .filter((module) => module.subtopics.length > 0);
    }, [course.modules, query]);

    const filteredTopicCount = filteredModules.reduce(
        (total, module) => total + module.subtopics.length,
        0,
    );

    const toggleTopic = (topicId: string) => {
        setExpanded((current) => ({
            ...current,
            [topicId]: !current[topicId],
        }));
    };

    return (
        <section className="mx-auto mt-8 max-w-7xl px-3 pb-14 sm:px-6 lg:px-10">
            {/* Search + module nav */}
            <div className="border-y border-black/10 py-5 dark:border-[#D5D5D5]/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex h-12 min-w-0 flex-1 items-center border border-black bg-white px-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-colors focus-within:border-black dark:border-[#D5D5D5] dark:bg-[#3D414E] dark:shadow-[2px_2px_0_0_rgba(213,213,213,0.4)]">
                        <AppImage src={SearchIcon} alt="search" className="dark:invert-[.835]" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search topics, takeaways, or questions..."
                            className="h-full min-w-0 flex-1 bg-transparent px-4 py-0 text-sm text-black placeholder:text-black/50 focus:outline-none sm:text-base dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/60"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label="Clear search"
                                className="inline-flex h-7 w-7 items-center justify-center text-black/60 transition-colors hover:text-black dark:text-[#D5D5D5]/70 dark:hover:text-[#3BF4C7]"
                            >
                                <svg
                                    viewBox="0 0 14 14"
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                >
                                    <path d="M1 1L13 13M13 1L1 13" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        <span>
                            {formatCount(filteredTopicCount)} topic
                            {filteredTopicCount === 1 ? "" : "s"} visible
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {filteredModules.map((module) => (
                        <a
                            key={module.id}
                            href={`#${moduleAnchor(module)}`}
                            className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                        >
                            {module.title}
                        </a>
                    ))}
                </div>
            </div>

            {filteredModules.length === 0 ? (
                <div className="border-2 border-dashed border-black/30 p-10 text-center dark:border-[#D5D5D5]/30 mt-8">
                    <h2 className="text-2xl font-black text-black dark:text-[#D5D5D5]">
                        No matching topics
                    </h2>
                    <p className="mt-2 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                        Try a broader keyword like a module name or subject concept.
                    </p>
                </div>
            ) : (
                <div className="grid gap-12 pt-8">
                    {filteredModules.map((module) => (
                        <section key={module.id} id={moduleAnchor(module)} className="scroll-mt-24">
                            <div className="flex flex-col gap-4 border-b border-black/10 pb-4 dark:border-[#D5D5D5]/10 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-black dark:text-[#D5D5D5] sm:text-3xl">
                                        {module.title}
                                    </h2>
                                    <p className="mt-1 text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                        {formatCount(module.counts.topicCount)} topic{module.counts.topicCount === 1 ? "" : "s"} in this module
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 text-sm text-black/60 dark:text-[#D5D5D5]/60">
                                    <span className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/25 px-3 dark:border-[#ffffff]/15 dark:bg-[#ffffff]/8">
                                        {formatCount(
                                            module.counts.videoCount +
                                                module.counts.exampleVideoCount,
                                        )}{" "}
                                        videos
                                    </span>
                                    <span className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/25 px-3 dark:border-[#ffffff]/15 dark:bg-[#ffffff]/8">
                                        {formatCount(module.counts.questionCount)} questions
                                    </span>
                                    <span className="inline-flex h-9 items-center border-2 border-[#5FC4E7] bg-[#5FC4E7]/25 px-3 dark:border-[#ffffff]/15 dark:bg-[#ffffff]/8">
                                        {formatCount(module.counts.takeawayCount)} takeaways
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-4">
                                {module.subtopics.map((topic) => {
                                    const isExpanded = Boolean(expanded[topic.id]);
                                    const totalVideos =
                                        topic.counts.videoCount +
                                        topic.counts.exampleVideoCount;

                                    return (
                                        <article
                                            key={topic.id}
                                            className="overflow-hidden border-2 border-[#5FC4E7] bg-white dark:border-[#ffffff]/20 dark:bg-[#0C1222]"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleTopic(topic.id)}
                                                className="grid w-full gap-4 px-4 py-4 text-left transition hover:bg-[#5FC4E7]/15 dark:hover:bg-[#ffffff]/5 sm:px-5"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-black leading-tight text-black dark:text-[#D5D5D5] sm:text-xl">
                                                            {topic.title}
                                                        </h3>
                                                        {topic.title !== topic.name ? (
                                                            <p className="mt-1.5 text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                                                {topic.name}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <ChevronDown
                                                        className={`mt-1 h-5 w-5 shrink-0 text-black/45 transition ${
                                                            isExpanded ? "rotate-180" : ""
                                                        } dark:text-[#D5D5D5]/45`}
                                                    />
                                                </div>

                                                <div className="flex flex-wrap gap-2 text-xs font-semibold text-black/55 dark:text-[#D5D5D5]/55">
                                                    <span className="inline-flex h-7 items-center gap-1.5 bg-[#5FC4E7]/25 px-2.5 dark:bg-[#ffffff]/8">
                                                        <Layers3 className="h-3 w-3" />
                                                        {formatCount(topic.counts.takeawayCount)} notes
                                                    </span>
                                                    <span className="inline-flex h-7 items-center gap-1.5 bg-[#5FC4E7]/25 px-2.5 dark:bg-[#ffffff]/8">
                                                        <ListVideo className="h-3 w-3" />
                                                        {formatCount(totalVideos)} videos
                                                    </span>
                                                    <span className="inline-flex h-7 items-center gap-1.5 bg-[#5FC4E7]/25 px-2.5 dark:bg-[#ffffff]/8">
                                                        <MessageSquareQuote className="h-3 w-3" />
                                                        {formatCount(topic.counts.questionCount)} questions
                                                    </span>
                                                    {topic.counts.assetCount > 0 && (
                                                        <span className="inline-flex h-7 items-center gap-1.5 bg-[#5FC4E7]/25 px-2.5 dark:bg-[#ffffff]/8">
                                                            <ImageIcon className="h-3 w-3" />
                                                            {formatCount(topic.counts.assetCount)} assets
                                                        </span>
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded ? (
                                                <div className="grid gap-8 border-t border-black/10 px-4 py-5 dark:border-[#D5D5D5]/10 sm:px-5">
                                                    <div className="flex flex-wrap gap-2">
                                                        <a
                                                            href={getTopicRemoteUrl(sourceOrigin, topic)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-9 items-center gap-2 border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                            Open original topic
                                                        </a>
                                                        {topic.pdfLink ? (
                                                            <a
                                                                href={topic.pdfLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-9 items-center gap-2 border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                                Open resource
                                                            </a>
                                                        ) : null}
                                                    </div>

                                                    {totalVideos > 0 ? (
                                                        <section className="grid gap-4">
                                                            <h4 className="flex items-center gap-2 text-sm font-bold text-black/70 dark:text-[#D5D5D5]/70">
                                                                <ListVideo className="h-4 w-4" />
                                                                Videos
                                                            </h4>
                                                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                                {topic.videos.map((video, index) => (
                                                                    <VideoTile
                                                                        key={`${topic.id}-video-${index}`}
                                                                        url={video}
                                                                        index={index}
                                                                        label="Lecture"
                                                                    />
                                                                ))}
                                                                {topic.exampleVideos.map(
                                                                    (video, index) => (
                                                                        <VideoTile
                                                                            key={`${topic.id}-example-${index}`}
                                                                            url={video}
                                                                            index={index}
                                                                            label="Worked example"
                                                                        />
                                                                    ),
                                                                )}
                                                            </div>
                                                        </section>
                                                    ) : null}

                                                    {topic.takeaways.length > 0 ? (
                                                        <section className="grid gap-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-bold text-black/70 dark:text-[#D5D5D5]/70">
                                                                <Layers3 className="h-4 w-4" />
                                                                Key takeaways
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {topic.takeaways.map((item, index) => (
                                                                    <RichItemBlock
                                                                        key={`${topic.id}-takeaway-${index}`}
                                                                        item={item}
                                                                        index={index}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </section>
                                                    ) : null}

                                                    {topic.questions.length > 0 ? (
                                                        <section className="grid gap-3">
                                                            <h4 className="flex items-center gap-2 text-sm font-bold text-black/70 dark:text-[#D5D5D5]/70">
                                                                <MessageSquareQuote className="h-4 w-4" />
                                                                Previous questions
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {topic.questions.map((item, index) => (
                                                                    <RichItemBlock
                                                                        key={`${topic.id}-question-${index}`}
                                                                        item={item}
                                                                        index={index}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </section>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </section>
    );
}
