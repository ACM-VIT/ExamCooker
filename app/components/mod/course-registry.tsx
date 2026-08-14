"use client";

import Link from "next/link";
import {
    ArrowLeft,
    BookOpenText,
    ExternalLink,
    FileText,
    Hourglass,
    LibraryBig,
    Plus,
    Search,
} from "lucide-react";
import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
    createManagedCourse,
    updateManagedCourse,
    type ModeratorCourseRecord,
} from "@/app/actions/manage-courses";
import { useToast } from "@/app/components/ui/use-toast";
import { getCoursePastPapersPath } from "@/lib/seo";

type Props = {
    initialCourses: ModeratorCourseRecord[];
};

type RegistryFilter = "all" | "empty" | "shared";

type CourseDraft = {
    code: string;
    title: string;
    aliases: string;
};

const emptyDraft: CourseDraft = { code: "", title: "", aliases: "" };

const quietButton =
    "ec-press inline-flex h-9 items-center gap-2 border border-black/30 px-3 text-sm font-normal transition hover:border-black disabled:cursor-wait disabled:opacity-60 dark:border-white/30 dark:hover:border-white";

const fieldLabel =
    "text-xs font-semibold text-black/70 dark:text-[#D5D5D5]/70";

const fieldInput =
    "ec-focus-ring mt-1.5 w-full border border-black/30 bg-white/70 px-3 text-sm outline-none placeholder:text-black/40 dark:border-white/30 dark:bg-white/5 dark:placeholder:text-[#D5D5D5]/40";

// Same primary-button treatment as the moderation workbench: a backing layer
// behind a bordered button that slides up-left on hover to reveal it.
function PrimaryButton({
    type = "button",
    onClick,
    disabled,
    children,
}: {
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <span className="group relative inline-flex h-9 w-fit items-stretch">
            <span
                aria-hidden="true"
                className="absolute inset-0 bg-[#0A0F1C] group-has-[:disabled]:hidden dark:bg-[#3BF4C7]"
            />
            <button
                type={type}
                onClick={onClick}
                disabled={disabled}
                className="relative inline-flex h-full items-center gap-2 border-2 border-black bg-[#3BF4C7] px-3 text-sm font-bold text-black transition duration-150 enabled:group-hover:-translate-x-1 enabled:group-hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:enabled:group-hover:border-[#3BF4C7] dark:enabled:group-hover:text-[#3BF4C7]"
            >
                {children}
            </button>
        </span>
    );
}

function StatCard({ label, value, detail }: { label: string; value: number; detail: string }) {
    return (
        <article className="flex min-h-32 flex-col border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-left text-black dark:border-white/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222]">
            <span className="block text-sm font-normal text-black/65 dark:text-[#D5D5D5]/65">
                {label}
            </span>
            <span className="mt-auto block pt-5">
                <strong className="block text-3xl font-black leading-none tabular-nums sm:text-4xl">
                    {value.toLocaleString("en-IN")}
                </strong>
                <span className="mt-2 block text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/55">
                    {detail}
                </span>
            </span>
        </article>
    );
}

function titleKey(title: string) {
    return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function toDraft(course: ModeratorCourseRecord): CourseDraft {
    return {
        code: course.code,
        title: course.title,
        aliases: course.aliases.filter((alias) => alias !== course.title).join("\n"),
    };
}

function parseAliases(value: string) {
    return value
        .split(/[\n,]+/)
        .map((alias) => alias.trim())
        .filter(Boolean);
}

function totalContent(course: ModeratorCourseRecord) {
    return course.livePaperCount + course.liveNoteCount;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

export default function CourseRegistry({ initialCourses }: Props) {
    const { toast } = useToast();
    const [courses, setCourses] = useState(initialCourses);
    const [selectedId, setSelectedId] = useState<string | null>(
        initialCourses[0]?.id ?? null,
    );
    const [mode, setMode] = useState<"create" | "edit">("edit");
    const [draft, setDraft] = useState<CourseDraft>(() =>
        initialCourses[0] ? toDraft(initialCourses[0]) : emptyDraft,
    );
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<RegistryFilter>("all");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("en"));

    const titleGroups = useMemo(() => {
        const groups = new Map<string, ModeratorCourseRecord[]>();
        for (const course of courses) {
            const key = titleKey(course.title);
            groups.set(key, [...(groups.get(key) ?? []), course]);
        }
        return groups;
    }, [courses]);

    const sharedCourseIds = useMemo(
        () =>
            new Set(
                [...titleGroups.values()]
                    .filter((group) => group.length > 1)
                    .flatMap((group) => group.map((course) => course.id)),
            ),
        [titleGroups],
    );

    const filteredCourses = useMemo(() => {
        return courses.filter((course) => {
            if (filter === "empty" && totalContent(course) > 0) return false;
            if (filter === "shared" && !sharedCourseIds.has(course.id)) return false;
            if (!deferredQuery) return true;
            const haystack = [course.code, course.title, ...course.aliases]
                .join(" ")
                .toLocaleLowerCase("en");
            return haystack.includes(deferredQuery);
        });
    }, [courses, deferredQuery, filter, sharedCourseIds]);

    const selected = courses.find((course) => course.id === selectedId) ?? null;
    const siblingCodes = selected
        ? (titleGroups.get(titleKey(selected.title)) ?? []).filter(
              (course) => course.id !== selected.id,
          )
        : [];
    const stats = useMemo(
        () => ({
            papers: courses.reduce((sum, course) => sum + course.livePaperCount, 0),
            notes: courses.reduce((sum, course) => sum + course.liveNoteCount, 0),
            sharedGroups: [...titleGroups.values()].filter((group) => group.length > 1)
                .length,
        }),
        [courses, titleGroups],
    );

    function selectCourse(course: ModeratorCourseRecord) {
        setSelectedId(course.id);
        setMode("edit");
        setDraft(toDraft(course));
        setError(null);
    }

    function beginCreate() {
        setSelectedId(null);
        setMode("create");
        setDraft(emptyDraft);
        setError(null);
    }

    function submit() {
        setError(null);
        startTransition(async () => {
            const input = {
                code: draft.code,
                title: draft.title,
                aliases: parseAliases(draft.aliases),
            };
            const result =
                mode === "create"
                    ? await createManagedCourse(input)
                    : selected
                      ? await updateManagedCourse(selected.id, input)
                      : { success: false as const, error: "Choose a course to edit." };

            if (!result.success) {
                setError(result.error);
                return;
            }

            setCourses((current) => {
                const exists = current.some((course) => course.id === result.course.id);
                const next = exists
                    ? current.map((course) =>
                          course.id === result.course.id ? result.course : course,
                      )
                    : [...current, result.course];
                return next.sort((a, b) => a.code.localeCompare(b.code));
            });
            setSelectedId(result.course.id);
            setMode("edit");
            setDraft(toDraft(result.course));
            toast({
                title: mode === "create" ? "Course created." : "Course updated.",
                description: `${result.course.code} · ${result.course.title}`,
            });
        });
    }

    return (
        <div className="min-h-dvh bg-[#C2E6EC] text-black transition-colors dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
                <header className="border-b-2 border-black/20 pb-5 dark:border-white/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href="/mod"
                            className="inline-flex h-9 items-center gap-2 text-sm font-semibold text-black/65 transition hover:text-black dark:text-[#D5D5D5]/65 dark:hover:text-[#D5D5D5]"
                        >
                            <ArrowLeft className="size-4" aria-hidden />
                            Moderation queue
                        </Link>
                        <PrimaryButton onClick={beginCreate}>
                            <Plus className="size-4" aria-hidden />
                            Add course
                        </PrimaryButton>
                    </div>
                    <div className="mt-5 max-w-3xl">
                        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
                            Course registry
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-black/65 dark:text-[#D5D5D5]/65">
                            Create canonical course codes, keep names and search aliases clean,
                            and spot same-title codes before students hit an empty course page.
                        </p>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Catalog summary">
                    <StatCard label="Courses" value={courses.length} detail="Canonical course codes" />
                    <StatCard label="Papers" value={stats.papers} detail="Approved and public" />
                    <StatCard label="Notes" value={stats.notes} detail="Approved and public" />
                    <StatCard
                        label="Shared names"
                        value={stats.sharedGroups}
                        detail="Titles with multiple codes"
                    />
                </section>

                <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
                    <div className="flex flex-col border-2 border-black/20 dark:border-white/20 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
                        <div className="shrink-0 space-y-2 border-b border-black/10 p-3 dark:border-white/10">
                            <div className="ec-focus-ring flex h-10 items-center border border-black/30 bg-white/60 px-3 dark:border-white/30 dark:bg-white/5">
                                <Search className="size-4 shrink-0 text-black/45 dark:text-[#D5D5D5]/45" aria-hidden />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search code, title, or alias"
                                    className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-black/40 dark:placeholder:text-[#D5D5D5]/40"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Registry filter">
                                {([
                                    ["all", "All"],
                                    ["empty", "No material"],
                                    ["shared", "Shared title"],
                                ] as const).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={filter === value}
                                        onClick={() => setFilter(value)}
                                        className={`h-9 border px-3 text-xs font-normal transition ${
                                            filter === value
                                                ? "border-black bg-black text-[#C2E6EC] dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]"
                                                : "border-black/25 hover:border-black dark:border-white/25 dark:hover:border-white"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                                <span className="ml-auto text-xs tabular-nums text-black/45 dark:text-[#D5D5D5]/45">
                                    {filteredCourses.length}
                                </span>
                            </div>
                        </div>

                        {filteredCourses.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-black/55 dark:text-[#D5D5D5]/55">
                                No courses match this view.
                            </p>
                        ) : (
                            <ul className="min-h-0 flex-1 lg:overflow-y-auto">
                                {filteredCourses.map((course) => {
                                    const active = course.id === selectedId && mode === "edit";
                                    const shared = sharedCourseIds.has(course.id);
                                    return (
                                        <li
                                            key={course.id}
                                            className="border-t border-black/10 first:border-t-0 dark:border-white/10"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectCourse(course)}
                                                aria-current={active ? "true" : undefined}
                                                className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
                                                    active
                                                        ? "bg-[#5FC4E7]/35 dark:bg-white/[0.07]"
                                                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                                                }`}
                                            >
                                                <span
                                                    className={`mt-1.5 size-1.5 shrink-0 ${
                                                        totalContent(course) > 0
                                                            ? "bg-emerald-600 dark:bg-emerald-300"
                                                            : "bg-black/30 dark:bg-white/30"
                                                    }`}
                                                    aria-hidden
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-bold tracking-wide">
                                                            {course.code}
                                                        </span>
                                                        {shared ? (
                                                            <span className="bg-[#5FC4E7]/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7]">
                                                                shared
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span
                                                        className={`mt-0.5 line-clamp-2 block text-sm leading-snug ${active ? "font-bold" : "font-semibold"}`}
                                                    >
                                                        {course.title}
                                                    </span>
                                                    <span className="mt-1 block text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
                                                        {course.livePaperCount} papers · {course.liveNoteCount} notes
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="border-2 border-black/20 p-4 dark:border-white/20 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10">
                            <div>
                                <p className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                                    {mode === "create" ? "New record" : "Catalog record"}
                                </p>
                                <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">
                                    {mode === "create" ? "Add a course" : selected?.code ?? "Choose a course"}
                                </h2>
                            </div>
                            {selected && mode === "edit" ? (
                                <Link
                                    href={getCoursePastPapersPath(selected.code)}
                                    className={quietButton}
                                >
                                    Open course <ExternalLink className="size-3.5" aria-hidden />
                                </Link>
                            ) : null}
                        </div>

                        {mode === "create" || selected ? (
                            <form
                                className="mt-5"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    submit();
                                }}
                            >
                                <div className="grid gap-4 sm:grid-cols-[0.72fr_1.28fr]">
                                    <label className="block">
                                        <span className={fieldLabel}>Course code</span>
                                        <input
                                            value={draft.code}
                                            onChange={(event) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    code: event.target.value.toUpperCase(),
                                                }))
                                            }
                                            required
                                            maxLength={40}
                                            spellCheck={false}
                                            placeholder="BAESP101"
                                            className={`${fieldInput} h-10 font-mono font-bold`}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabel}>Display title</span>
                                        <input
                                            value={draft.title}
                                            onChange={(event) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    title: event.target.value,
                                                }))
                                            }
                                            required
                                            maxLength={160}
                                            placeholder="Spanish Level 1"
                                            className={`${fieldInput} h-10 font-semibold`}
                                        />
                                    </label>
                                </div>

                                <label className="mt-4 block">
                                    <span className={fieldLabel}>Search aliases</span>
                                    <textarea
                                        value={draft.aliases}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                aliases: event.target.value,
                                            }))
                                        }
                                        rows={4}
                                        placeholder={"Spanish I\nElementary Spanish\nESP101"}
                                        className={`${fieldInput} resize-y py-2.5 leading-6`}
                                    />
                                    <span className="mt-1.5 block text-[11px] text-black/50 dark:text-[#D5D5D5]/50">
                                        One per line or comma-separated. The display title is included automatically.
                                    </span>
                                </label>

                                {selected && mode === "edit" ? (
                                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {[
                                            {
                                                label: "Live papers",
                                                value: selected.livePaperCount,
                                                icon: FileText,
                                            },
                                            {
                                                label: "Live notes",
                                                value: selected.liveNoteCount,
                                                icon: BookOpenText,
                                            },
                                            {
                                                label: "Pending",
                                                value:
                                                    selected.pendingPaperCount +
                                                    selected.pendingNoteCount,
                                                icon: Hourglass,
                                            },
                                            {
                                                label: "Aliases",
                                                value: selected.aliases.length,
                                                icon: LibraryBig,
                                            },
                                        ].map(({ label, value, icon: Icon }) => (
                                            <div
                                                key={label}
                                                className="border border-black/15 p-2.5 dark:border-white/15"
                                            >
                                                <Icon className="size-3.5 text-black/45 dark:text-[#D5D5D5]/45" aria-hidden />
                                                <strong className="mt-2 block text-xl font-black tabular-nums">
                                                    {value}
                                                </strong>
                                                <span className="text-[11px] text-black/55 dark:text-[#D5D5D5]/55">
                                                    {label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {siblingCodes.length > 0 && mode === "edit" ? (
                                    <div className="mt-4 border border-black/20 bg-[#5FC4E7]/20 px-3 py-2.5 dark:border-white/15 dark:bg-white/[0.04]">
                                        <p className="text-xs font-bold">
                                            {siblingCodes.length + 1} codes share “{selected?.title}”
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {siblingCodes.map((course) => (
                                                <button
                                                    key={course.id}
                                                    type="button"
                                                    onClick={() => selectCourse(course)}
                                                    className="border border-black/25 px-2 py-1 font-mono text-[11px] font-bold transition hover:border-black dark:border-white/25 dark:hover:border-[#3BF4C7] dark:hover:text-[#3BF4C7]"
                                                >
                                                    {course.code} · {course.livePaperCount}P/{course.liveNoteCount}N
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {selected && mode === "edit" && draft.code !== selected.code ? (
                                    <p className="mt-4 border border-amber-600/40 bg-amber-200/35 px-3 py-2 text-xs leading-5 dark:border-amber-300/35 dark:bg-amber-300/[0.06] dark:text-amber-100">
                                        Changing the code changes the public course URL. Papers and notes stay attached by course ID.
                                    </p>
                                ) : null}

                                {error ? (
                                    <p
                                        role="alert"
                                        className="mt-4 border border-red-600/40 bg-red-100 px-3 py-2 text-sm text-red-900 dark:border-red-300/35 dark:bg-red-300/10 dark:text-red-100"
                                    >
                                        {error}
                                    </p>
                                ) : null}

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                                    <p className="text-[11px] text-black/45 dark:text-[#D5D5D5]/45">
                                        {selected && mode === "edit"
                                            ? `Created ${formatDate(selected.createdAt)} · Updated ${formatDate(selected.updatedAt)}`
                                            : "New courses become available to uploads and search after saving."}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {mode === "create" && courses.length > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() => selectCourse(courses[0])}
                                                className={quietButton}
                                            >
                                                Cancel
                                            </button>
                                        ) : null}
                                        <PrimaryButton type="submit" disabled={isPending}>
                                            {isPending ? (
                                                <span
                                                    className="size-3.5 animate-spin border-2 border-current border-t-transparent"
                                                    aria-hidden
                                                />
                                            ) : null}
                                            {mode === "create" ? "Create course" : "Save changes"}
                                        </PrimaryButton>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="flex min-h-80 flex-col items-center justify-center text-center">
                                <LibraryBig className="size-6 text-black/35 dark:text-[#D5D5D5]/35" aria-hidden />
                                <p className="mt-3 text-sm font-semibold">Choose a course to inspect.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
