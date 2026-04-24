"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    ListVideo,
    MessageSquareQuote,
    Play,
    Search as SearchIconLucide,
    X,
} from "lucide-react";
import AppImage from "@/app/components/common/AppImage";
import InlineYouTubePlayer from "@/app/components/resources/InlineYouTubePlayer";
import type {
    VinCourse,
    VinModule,
    VinRichItem,
    VinSubtopic,
} from "@/lib/data/vinTogether";

type VinCourseWorkspaceProps = {
    course: VinCourse;
};

type FlatTopicEntry = {
    topic: VinSubtopic;
    module: VinModule;
    moduleIndex: number;
    topicIndexInModule: number;
    globalIndex: number;
};

type PlaylistItem = {
    id: string;
    videoId: string;
    rawUrl: string;
    kind: "lecture" | "example";
    index: number;
    thumbnail: string | null;
};

type TabId = "notes" | "practice" | "resource";

type TopicViewState = {
    activeVideoIndex: number;
    activeTab: TabId | null;
    userPickedVideo: boolean;
};

function getYouTubeVideoId(url: string) {
    const match = url.match(
        /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^?&/]+)/i,
    );
    return match?.[1] ?? null;
}

function getYouTubeThumbnail(videoId: string) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function normalizeSearch(value: string) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function topicMatchesQuery(
    topic: VinSubtopic,
    moduleTitle: string,
    query: string,
) {
    if (!query) return true;
    const haystack = [
        moduleTitle,
        topic.name,
        topic.title,
        ...topic.takeaways.map((t) => t.text ?? ""),
        ...topic.questions.map((t) => t.text ?? ""),
    ]
        .join(" ")
        .toLowerCase();
    return normalizeSearch(haystack).includes(query);
}

function buildPlaylist(topic: VinSubtopic): PlaylistItem[] {
    const lectures: PlaylistItem[] = topic.videos.flatMap((url, i) => {
        const videoId = getYouTubeVideoId(url);
        if (!videoId) return [];
        return [
            {
                id: `${topic.id}-lecture-${i}`,
                videoId,
                rawUrl: url,
                kind: "lecture" as const,
                index: i,
                thumbnail: getYouTubeThumbnail(videoId),
            },
        ];
    });
    const examples: PlaylistItem[] = topic.exampleVideos.flatMap((url, i) => {
        const videoId = getYouTubeVideoId(url);
        if (!videoId) return [];
        return [
            {
                id: `${topic.id}-example-${i}`,
                videoId,
                rawUrl: url,
                kind: "example" as const,
                index: i,
                thumbnail: getYouTubeThumbnail(videoId),
            },
        ];
    });
    return [...lectures, ...examples];
}

function pickDefaultTab(topic: VinSubtopic): TabId | null {
    if (topic.takeaways.length > 0) return "notes";
    if (topic.questions.length > 0) return "practice";
    if (topic.pdfLink) return "resource";
    return null;
}

function getRichItemKey(prefix: string, item: VinRichItem) {
    return `${prefix}-${item.text ?? ""}-${item.image ?? ""}`;
}

function createTopicViewState(topic: VinSubtopic | null): TopicViewState {
    return {
        activeVideoIndex: 0,
        activeTab: topic ? pickDefaultTab(topic) : null,
        userPickedVideo: false,
    };
}

function RichBlock({ item, index }: { item: VinRichItem; index: number }) {
    return (
        <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-[11px] font-bold text-black/55 dark:bg-[#D5D5D5]/10 dark:text-[#D5D5D5]/55">
                {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-3">
                {item.text ? (
                    <p className="text-[15px] leading-relaxed text-black/85 dark:text-[#D5D5D5]/85">
                        {item.text}
                    </p>
                ) : null}
                {item.image ? (
                    <div className="relative overflow-hidden border border-black/10 bg-white dark:border-[#D5D5D5]/10 dark:bg-black">
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

function PlaylistTile({
    item,
    active,
    onSelect,
}: {
    item: PlaylistItem;
    active: boolean;
    onSelect: () => void;
}) {
    const label =
        item.kind === "lecture"
            ? `Lecture ${item.index + 1}`
            : `Worked example ${item.index + 1}`;

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={`group/tile relative flex w-full shrink-0 flex-col overflow-hidden border-2 text-left transition ${
                active
                    ? "border-[#5FC4E7] bg-[#5FC4E7]/25 dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10"
                    : "border-black/10 bg-white hover:border-[#5FC4E7] dark:border-[#ffffff]/15 dark:bg-[#0C1222] dark:hover:border-[#3BF4C7]/50"
            }`}
        >
            <div className="relative aspect-[16/9] bg-[#0d1320]">
                {item.thumbnail ? (
                    <AppImage
                        src={item.thumbnail}
                        alt={label}
                        fill
                        className="object-cover"
                    />
                ) : null}
                <div
                    className={`absolute inset-0 transition ${
                        active ? "bg-black/10" : "bg-black/30 group-hover/tile:bg-black/15"
                    }`}
                />
                <div className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 bg-black/60 px-2 text-[10px] font-bold uppercase tracking-wider text-white">
                    {item.kind === "lecture" ? "Lecture" : "Example"}
                </div>
                {active ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex h-9 w-9 items-center justify-center bg-[#5FC4E7] text-black dark:bg-[#3BF4C7]">
                            <Play className="h-4 w-4" fill="currentColor" />
                        </span>
                    </div>
                ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[12px] font-semibold text-black/75 dark:text-[#D5D5D5]/75">
                <span className="truncate">{label}</span>
            </div>
        </button>
    );
}

export default function VinCourseWorkspace({
    course,
}: VinCourseWorkspaceProps) {
    const flatTopics = useMemo<FlatTopicEntry[]>(() => {
        const entries: FlatTopicEntry[] = [];
        let globalIndex = 0;
        course.modules.forEach((module, moduleIndex) => {
            module.subtopics.forEach((topic, topicIndexInModule) => {
                entries.push({
                    topic,
                    module,
                    moduleIndex,
                    topicIndexInModule,
                    globalIndex: globalIndex++,
                });
            });
        });
        return entries;
    }, [course.modules]);

    const topicIndexById = useMemo(() => {
        const map = new Map<string, FlatTopicEntry>();
        flatTopics.forEach((entry) => map.set(entry.topic.id, entry));
        return map;
    }, [flatTopics]);

    const firstTopic = flatTopics[0]?.topic ?? null;
    const firstTopicId = firstTopic?.id ?? null;

    const [activeTopicId, setActiveTopicId] = useState<string | null>(
        firstTopicId,
    );
    const [topicView, setTopicView] = useState<TopicViewState>(() =>
        createTopicViewState(firstTopic),
    );
    const [query, setQuery] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const topicTopRef = useRef<HTMLDivElement | null>(null);
    const isInitialMount = useRef(true);

    const activateTopic = useCallback((id: string, closeDrawer = false) => {
        const nextTopic = topicIndexById.get(id)?.topic ?? null;
        setActiveTopicId(id);
        setTopicView(createTopicViewState(nextTopic));
        if (closeDrawer) {
            setDrawerOpen(false);
        }
    }, [topicIndexById]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const hash = window.location.hash.replace(/^#/, "");
        if (hash) {
            const fromHash = topicIndexById.get(hash);
            if (fromHash) {
                activateTopic(fromHash.topic.id);
            }
        }
        const handler = () => {
            const nextHash = window.location.hash.replace(/^#/, "");
            const next = topicIndexById.get(nextHash);
            if (next) {
                activateTopic(next.topic.id);
            }
        };
        window.addEventListener("hashchange", handler);
        return () => window.removeEventListener("hashchange", handler);
    }, [activateTopic, topicIndexById]);

    useEffect(() => {
        if (!activeTopicId) return;
        if (typeof window === "undefined") return;
        const nextHash = `#${activeTopicId}`;
        if (window.location.hash !== nextHash) {
            history.replaceState(null, "", nextHash);
        }
    }, [activeTopicId]);

    const activeEntry = activeTopicId ? topicIndexById.get(activeTopicId) : null;
    const activeTopic = activeEntry?.topic ?? null;

    const playlist = useMemo(
        () => (activeTopic ? buildPlaylist(activeTopic) : []),
        [activeTopic],
    );

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!topicTopRef.current) return;
        topicTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [activeTopicId]);

    const normalizedQuery = normalizeSearch(query);
    const filteredModules = useMemo(() => {
        if (!normalizedQuery) return course.modules;
        return course.modules
            .map((module) => {
                const matched = module.subtopics.filter((topic) =>
                    topicMatchesQuery(topic, module.title, normalizedQuery),
                );
                return { ...module, subtopics: matched };
            })
            .filter((module) => module.subtopics.length > 0);
    }, [course.modules, normalizedQuery]);

    const selectTopic = useCallback(
        (id: string) => {
            activateTopic(id, true);
        },
        [activateTopic],
    );

    const goNeighbour = useCallback(
        (delta: number) => {
            if (!activeEntry) return;
            const nextIndex = activeEntry.globalIndex + delta;
            if (nextIndex < 0 || nextIndex >= flatTopics.length) return;
            activateTopic(flatTopics[nextIndex].topic.id);
        },
        [activateTopic, activeEntry, flatTopics],
    );

    const activeVideo = playlist[topicView.activeVideoIndex] ?? null;
    const hasNotes = (activeTopic?.takeaways.length ?? 0) > 0;
    const hasQuestions = (activeTopic?.questions.length ?? 0) > 0;
    const hasResource = Boolean(activeTopic?.pdfLink);
    const totalTopics = flatTopics.length;

    return (
        <section className="relative mx-auto w-full max-w-7xl px-3 pb-16 sm:px-6 lg:px-10">
            <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
                {/* Sidebar — desktop */}
                <aside className="hidden lg:block">
                    <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden border-2 border-black/10 bg-white dark:border-[#ffffff]/10 dark:bg-[#0C1222]">
                        <SidebarBody
                            filteredModules={filteredModules}
                            query={query}
                            setQuery={setQuery}
                            activeTopicId={activeTopicId}
                            selectTopic={selectTopic}
                        />
                    </div>
                </aside>

                {/* Mobile drawer trigger */}
                <div className="lg:hidden">
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        className="flex w-full items-center justify-between gap-2 border border-black/15 bg-white px-3 py-2.5 text-left text-sm font-semibold text-black dark:border-[#ffffff]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
                    >
                        <span className="truncate">
                            {activeTopic?.title ?? "Choose a topic"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" />
                    </button>
                </div>

                {/* Main workspace */}
                <div className="min-w-0">
                    <div ref={topicTopRef} className="scroll-mt-20" />
                    {activeTopic && activeEntry ? (
                        <TopicWorkspace
                            key={activeTopic.id}
                            entry={activeEntry}
                            topic={activeTopic}
                            playlist={playlist}
                            activeVideo={activeVideo}
                            activeVideoIndex={topicView.activeVideoIndex}
                            onSelectVideo={(i) => {
                                setTopicView((current) => ({
                                    ...current,
                                    activeVideoIndex: i,
                                    userPickedVideo: true,
                                }));
                            }}
                            autoplay={topicView.userPickedVideo}
                            activeTab={topicView.activeTab}
                            setActiveTab={(tab) =>
                                setTopicView((current) => ({
                                    ...current,
                                    activeTab: tab,
                                }))
                            }
                            hasNotes={hasNotes}
                            hasQuestions={hasQuestions}
                            hasResource={hasResource}
                            onPrev={() => goNeighbour(-1)}
                            onNext={() => goNeighbour(1)}
                            prevTopicTitle={
                                flatTopics[activeEntry.globalIndex - 1]?.topic
                                    .title ?? null
                            }
                            nextTopicTitle={
                                flatTopics[activeEntry.globalIndex + 1]?.topic
                                    .title ?? null
                            }
                        />
                    ) : (
                        <div className="border-2 border-dashed border-black/20 p-10 text-center dark:border-[#D5D5D5]/20">
                            <h2 className="text-xl font-black text-black dark:text-[#D5D5D5]">
                                No topics available yet
                            </h2>
                            <p className="mt-2 text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                Content for this course is still being compiled.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile drawer */}
            {drawerOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col border-r border-black/10 bg-white dark:border-[#ffffff]/10 dark:bg-[#0C1222]">
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(false)}
                            aria-label="Close topics"
                            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center text-black/60 hover:text-black dark:text-[#D5D5D5]/60 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div className="flex-1 overflow-hidden">
                            <SidebarBody
                                filteredModules={filteredModules}
                                query={query}
                                setQuery={setQuery}
                                activeTopicId={activeTopicId}
                                selectTopic={selectTopic}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

type SidebarBodyProps = {
    filteredModules: VinModule[];
    query: string;
    setQuery: (value: string) => void;
    activeTopicId: string | null;
    selectTopic: (id: string) => void;
};

function SidebarBody({
    filteredModules,
    query,
    setQuery,
    activeTopicId,
    selectTopic,
}: SidebarBodyProps) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const isCollapsed = useCallback(
        (moduleId: string, hasActive: boolean) => {
            if (query) return false;
            if (moduleId in collapsed) return collapsed[moduleId];
            return !hasActive;
        },
        [collapsed, query],
    );

    const toggle = (moduleId: string) =>
        setCollapsed((current) => ({
            ...current,
            [moduleId]: !(current[moduleId] ?? true),
        }));

    return (
        <div className="flex h-full max-h-[calc(100vh-7rem)] flex-col">
            <div className="border-b border-black/10 p-3 dark:border-[#D5D5D5]/10">
                <div className="relative flex h-9 items-center border border-black/20 bg-[#F5F9FB] px-2 dark:border-[#D5D5D5]/20 dark:bg-[#0A0F1C]">
                    <SearchIconLucide className="h-3.5 w-3.5 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search topics"
                        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] text-black placeholder:text-black/45 focus:outline-none dark:text-[#D5D5D5] dark:placeholder:text-[#D5D5D5]/45"
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Clear search"
                            className="inline-flex h-6 w-6 items-center justify-center text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-1 py-2">
                {filteredModules.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-black/50 dark:text-[#D5D5D5]/50">
                        No matching topics.
                    </p>
                ) : (
                    filteredModules.map((module) => {
                        const containsActive = module.subtopics.some(
                            (topic) => topic.id === activeTopicId,
                        );
                        const hide = isCollapsed(module.id, containsActive);
                        return (
                            <div key={module.id} className="mb-1">
                                <button
                                    type="button"
                                    onClick={() => toggle(module.id)}
                                    className="group flex w-full items-center justify-between gap-2 px-2 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    <span className="min-w-0 truncate text-sm font-bold text-black dark:text-[#D5D5D5]">
                                        {module.title}
                                    </span>
                                    <ChevronDown
                                        className={`h-3.5 w-3.5 shrink-0 text-black/45 transition dark:text-[#D5D5D5]/45 ${
                                            hide ? "-rotate-90" : ""
                                        }`}
                                    />
                                </button>
                                {hide ? null : (
                                    <ul className="mb-2 ml-2 border-l border-black/10 dark:border-[#D5D5D5]/10">
                                        {module.subtopics.map((topic, i) => {
                                            const active = topic.id === activeTopicId;
                                            const videoCount =
                                                topic.counts.videoCount +
                                                topic.counts.exampleVideoCount;
                                            return (
                                                <li key={topic.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => selectTopic(topic.id)}
                                                        className={`relative flex w-full items-start gap-2 px-3 py-1.5 text-left text-[13px] leading-snug transition ${
                                                            active
                                                                ? "bg-[#5FC4E7]/30 text-black dark:bg-[#3BF4C7]/12 dark:text-[#D5D5D5]"
                                                                : "text-black/75 hover:bg-black/5 hover:text-black dark:text-[#D5D5D5]/75 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]"
                                                        }`}
                                                    >
                                                        {active ? (
                                                            <span className="absolute left-[-1px] top-0 h-full w-0.5 bg-[#5FC4E7] dark:bg-[#3BF4C7]" />
                                                        ) : null}
                                                        <span className="mt-0.5 shrink-0 text-[10px] font-bold text-black/40 dark:text-[#D5D5D5]/40">
                                                            {String(i + 1).padStart(2, "0")}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block font-semibold">
                                                                {topic.title}
                                                            </span>
                                                            {videoCount > 0 ? (
                                                                <span className="mt-0.5 block text-[11px] font-semibold text-black/45 dark:text-[#D5D5D5]/45">
                                                                    {videoCount}{" "}
                                                                    {videoCount === 1 ? "video" : "videos"}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

type TopicWorkspaceProps = {
    entry: FlatTopicEntry;
    topic: VinSubtopic;
    playlist: PlaylistItem[];
    activeVideo: PlaylistItem | null;
    activeVideoIndex: number;
    onSelectVideo: (index: number) => void;
    autoplay: boolean;
    activeTab: TabId | null;
    setActiveTab: (tab: TabId) => void;
    hasNotes: boolean;
    hasQuestions: boolean;
    hasResource: boolean;
    onPrev: () => void;
    onNext: () => void;
    prevTopicTitle: string | null;
    nextTopicTitle: string | null;
};

function TopicWorkspace({
    topic,
    playlist,
    activeVideo,
    activeVideoIndex,
    onSelectVideo,
    autoplay,
    activeTab,
    setActiveTab,
    hasNotes,
    hasQuestions,
    hasResource,
    onPrev,
    onNext,
    prevTopicTitle,
    nextTopicTitle,
}: TopicWorkspaceProps) {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-[#D5D5D5]/10">
                <h2 className="text-2xl font-black leading-tight text-black dark:text-[#D5D5D5] sm:text-[28px]">
                    {topic.title}
                </h2>
                {topic.title !== topic.name ? (
                    <p className="text-sm text-black/55 dark:text-[#D5D5D5]/55">
                        {topic.name}
                    </p>
                ) : null}
                {topic.pdfLink ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                            href={topic.pdfLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 border border-black/15 px-2.5 text-[12px] font-semibold text-black/75 transition hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/75 dark:hover:border-[#D5D5D5]/40 dark:hover:text-[#D5D5D5]"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            PDF resource
                        </a>
                    </div>
                ) : null}
            </header>

            {/* Video section */}
            {playlist.length > 0 && activeVideo ? (
                <section className="flex flex-col gap-3">
                    <InlineYouTubePlayer
                        videoId={activeVideo.videoId}
                        title={`${topic.title} — ${activeVideo.kind === "lecture" ? `Lecture ${activeVideo.index + 1}` : `Worked example ${activeVideo.index + 1}`}`}
                        autoplay={autoplay}
                    />
                    <div className="flex items-center justify-between text-[12px] font-semibold text-black/55 dark:text-[#D5D5D5]/55">
                        <span>
                            {activeVideoIndex + 1} / {playlist.length}
                        </span>
                        {playlist.length > 1 ? (
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSelectVideo(
                                            (activeVideoIndex - 1 + playlist.length) % playlist.length,
                                        )
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center border border-black/15 text-black/70 hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/70 dark:hover:border-[#D5D5D5]/40 dark:hover:text-[#D5D5D5]"
                                    aria-label="Previous video"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSelectVideo((activeVideoIndex + 1) % playlist.length)
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center border border-black/15 text-black/70 hover:border-black/40 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/70 dark:hover:border-[#D5D5D5]/40 dark:hover:text-[#D5D5D5]"
                                    aria-label="Next video"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        ) : null}
                    </div>
                    {playlist.length > 1 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                            {playlist.map((item, i) => (
                                <PlaylistTile
                                    key={item.id}
                                    item={item}
                                    active={i === activeVideoIndex}
                                    onSelect={() => onSelectVideo(i)}
                                />
                            ))}
                        </div>
                    ) : null}
                </section>
            ) : (
                <div className="border-2 border-dashed border-black/15 p-6 text-center text-sm text-black/55 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5]/55">
                    <ListVideo className="mx-auto h-5 w-5 text-black/35 dark:text-[#D5D5D5]/35" />
                    <p className="mt-2">No videos for this topic.</p>
                </div>
            )}

            {/* Tabs */}
            {hasNotes || hasQuestions || hasResource ? (
                <section className="flex flex-col">
                    <div className="flex items-center gap-1 border-b border-black/10 dark:border-[#D5D5D5]/10">
                        {hasNotes ? (
                            <TabButton
                                label="Notes"
                                icon={<FileText className="h-3.5 w-3.5" />}
                                count={topic.takeaways.length}
                                active={activeTab === "notes"}
                                onClick={() => setActiveTab("notes")}
                            />
                        ) : null}
                        {hasQuestions ? (
                            <TabButton
                                label="Practice"
                                icon={<MessageSquareQuote className="h-3.5 w-3.5" />}
                                count={topic.questions.length}
                                active={activeTab === "practice"}
                                onClick={() => setActiveTab("practice")}
                            />
                        ) : null}
                        {hasResource ? (
                            <TabButton
                                label="Resource"
                                icon={<FileText className="h-3.5 w-3.5" />}
                                active={activeTab === "resource"}
                                onClick={() => setActiveTab("resource")}
                            />
                        ) : null}
                    </div>
                    <div className="pt-5">
                        {activeTab === "notes" && hasNotes ? (
                            <div className="divide-y divide-black/10 dark:divide-[#D5D5D5]/10">
                                {topic.takeaways.map((item, i) => (
                                    <RichBlock
                                        key={getRichItemKey(`${topic.id}-takeaway`, item)}
                                        item={item}
                                        index={i}
                                    />
                                ))}
                            </div>
                        ) : null}
                        {activeTab === "practice" && hasQuestions ? (
                            <div className="divide-y divide-black/10 dark:divide-[#D5D5D5]/10">
                                {topic.questions.map((item, i) => (
                                    <RichBlock
                                        key={getRichItemKey(`${topic.id}-question`, item)}
                                        item={item}
                                        index={i}
                                    />
                                ))}
                            </div>
                        ) : null}
                        {activeTab === "resource" && hasResource ? (
                            <div className="flex flex-col items-start gap-3">
                                <p className="text-sm text-black/70 dark:text-[#D5D5D5]/70">
                                    This topic links to an external resource document.
                                </p>
                                <a
                                    href={topic.pdfLink ?? undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-10 items-center gap-2 border-2 border-[#5FC4E7] bg-[#5FC4E7]/40 px-4 text-sm font-semibold text-black transition hover:bg-[#5FC4E7]/60 dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:hover:bg-[#ffffff]/15"
                                >
                                    <FileText className="h-4 w-4" />
                                    Open resource
                                </a>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}

            {prevTopicTitle || nextTopicTitle ? (
                <nav className="mt-2 flex items-stretch gap-3 border-t border-black/10 pt-5 dark:border-[#D5D5D5]/10">
                    {prevTopicTitle ? (
                        <button
                            type="button"
                            onClick={onPrev}
                            className="group flex min-w-0 flex-1 items-center gap-3 border border-black/10 bg-white px-3 py-2.5 text-left transition hover:border-black/40 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:hover:border-[#D5D5D5]/40"
                        >
                            <ChevronLeft className="h-4 w-4 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-[#D5D5D5]">
                                {prevTopicTitle}
                            </span>
                        </button>
                    ) : (
                        <span className="flex-1" />
                    )}
                    {nextTopicTitle ? (
                        <button
                            type="button"
                            onClick={onNext}
                            className="group flex min-w-0 flex-1 items-center gap-3 border border-black/10 bg-white px-3 py-2.5 text-right transition hover:border-black/40 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:hover:border-[#D5D5D5]/40"
                        >
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-[#D5D5D5]">
                                {nextTopicTitle}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-black/55 dark:text-[#D5D5D5]/55" />
                        </button>
                    ) : (
                        <span className="flex-1" />
                    )}
                </nav>
            ) : null}
        </div>
    );
}

function TabButton({
    label,
    icon,
    count,
    active,
    onClick,
}: {
    label: string;
    icon: React.ReactNode;
    count?: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`relative inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold transition ${
                active
                    ? "text-black dark:text-[#D5D5D5]"
                    : "text-black/55 hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
            }`}
        >
            {icon}
            {label}
            {typeof count === "number" ? (
                <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                        active
                            ? "bg-[#5FC4E7] text-black dark:bg-[#3BF4C7]/70"
                            : "bg-black/10 text-black/65 dark:bg-white/10 dark:text-[#D5D5D5]/70"
                    }`}
                >
                    {count}
                </span>
            ) : null}
            {active ? (
                <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#5FC4E7] dark:bg-[#3BF4C7]" />
            ) : null}
        </button>
    );
}
