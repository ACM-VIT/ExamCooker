"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react";
import { useSession } from "next-auth/react";
import { updatePastPaperTags } from "@/app/actions/updatePastPaperTags";
import { useToast } from "@/components/ui/use-toast";
import Fuse from "fuse.js";

type PastPaperTagEditorProps = {
    paperId: string;
    initialTags: string[];
    allTags: string[];
};

function normalizeTag(tag: string) {
    return tag.trim().replace(/\s+/g, " ");
}

function dedupeTags(tags: string[]) {
    const map = new Map<string, string>();
    for (const tag of tags) {
        const cleaned = normalizeTag(tag);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (!map.has(key)) map.set(key, cleaned);
    }
    return Array.from(map.values());
}

export default function PastPaperTagEditor({
    paperId,
    initialTags,
    allTags,
}: PastPaperTagEditorProps) {
    const { data: session } = useSession();
    const role = session?.user?.role;
    const { toast } = useToast();
    const [tags, setTags] = useState(() => dedupeTags(initialTags));
    const [baselineTags, setBaselineTags] = useState(() =>
        dedupeTags(initialTags)
    );
    const [inputValue, setInputValue] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredTags, setFilteredTags] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const availableTags = useMemo(() => dedupeTags(allTags), [allTags]);
    const fuse = useMemo(
        () =>
            new Fuse(availableTags, {
                threshold: 0.6,
                minMatchCharLength: 2,
            }),
        [availableTags]
    );

    const hasChanges = useMemo(() => {
        const initialKeys = new Set(
            baselineTags.map((tag) => normalizeTag(tag).toLowerCase())
        );
        const currentKeys = new Set(
            tags.map((tag) => normalizeTag(tag).toLowerCase())
        );
        if (initialKeys.size !== currentKeys.size) return true;
        for (const key of initialKeys) {
            if (!currentKeys.has(key)) return true;
        }
        return false;
    }, [baselineTags, tags]);

    if (role !== "MODERATOR") return null;

    const addTag = (value?: string) => {
        const cleaned = normalizeTag(value ?? inputValue);
        if (!cleaned) return;
        setTags((prev) => {
            const next = dedupeTags([...prev, cleaned]);
            return next;
        });
        setInputValue("");
        setShowDropdown(false);
    };

    const removeTag = (tag: string) => {
        const targetKey = normalizeTag(tag).toLowerCase();
        setTags((prev) =>
            prev.filter(
                (item) => normalizeTag(item).toLowerCase() !== targetKey
            )
        );
    };

    const handleSave = () => {
        if (!hasChanges) return;
        startTransition(async () => {
            try {
                await updatePastPaperTags(paperId, tags);
                setBaselineTags(dedupeTags(tags));
                toast({ title: "Tags updated" });
            } catch (error) {
                console.error("Failed to update tags:", error);
                toast({
                    title: "Failed to update tags",
                    variant: "destructive",
                });
            }
        });
    };

    useEffect(() => {
        if (!inputValue) {
            setFilteredTags(availableTags);
            return;
        }
        const results = fuse.search(inputValue);
        setFilteredTags(results.map((result) => result.item));
    }, [availableTags, fuse, inputValue]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="mt-4 rounded-md border border-black/20 dark:border-[#D5D5D5]/30 bg-white/70 dark:bg-[#0C1222] p-3">
            <div className="text-sm font-semibold">Admin tag editor</div>
            <div className="mt-2 flex flex-wrap gap-2">
                {tags.length ? (
                    tags.map((tag) => (
                        <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-[#C2E6EC] dark:bg-[#3F4451] px-2 py-1 text-xs"
                        >
                            #{tag}
                            <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="ml-1 rounded-full px-1 text-xs hover:bg-black/10 dark:hover:bg-white/10"
                                aria-label={`Remove ${tag}`}
                            >
                                ×
                            </button>
                        </span>
                    ))
                ) : (
                    <span className="text-xs text-black/60 dark:text-[#D5D5D5]/70">
                        No tags yet
                    </span>
                )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <div ref={dropdownRef} className="relative min-w-[180px] flex-1">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                if (!inputValue.trim()) return;
                                if (filteredTags.length) {
                                    addTag(filteredTags[0]);
                                    return;
                                }
                                addTag();
                            }
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search or add a tag"
                        className="w-full rounded-md border border-black/20 dark:border-[#D5D5D5]/30 bg-white dark:bg-[#0C1222] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showDropdown && filteredTags.length ? (
                        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-black/20 bg-white text-sm shadow-lg dark:border-[#D5D5D5]/20 dark:bg-[#232530]">
                            {filteredTags
                                .filter(
                                    (tag) =>
                                        !tags
                                            .map((item) =>
                                                normalizeTag(item).toLowerCase()
                                            )
                                            .includes(
                                                normalizeTag(tag).toLowerCase()
                                            )
                                )
                                .slice(0, 8)
                                .map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => addTag(tag)}
                                        className="block w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                                    >
                                        {tag}
                                    </button>
                                ))}
                        </div>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => addTag()}
                    className="rounded-md border border-black/20 dark:border-[#D5D5D5]/30 bg-white px-3 py-1 text-sm hover:bg-black/5 dark:bg-[#0C1222] dark:hover:bg-white/10"
                >
                    Add
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges || isPending}
                    className="rounded-md bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
                >
                    {isPending ? "Saving..." : "Save"}
                </button>
            </div>
        </div>
    );
}
