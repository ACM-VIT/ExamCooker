"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dedupeTagNames, normalizeTagName } from "./tag-utils";

type TagFieldProps = {
  disabled?: boolean;
  onChange: (nextTags: string[]) => void;
  placeholder?: string;
  suggestions: string[];
  value: string[];
};

export default function TagField({
  disabled = false,
  onChange,
  placeholder = "Add a tag",
  suggestions,
  value,
}: TagFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedTags = useMemo(() => dedupeTagNames(value), [value]);

  const filteredSuggestions = useMemo(() => {
    const selected = new Set(
      normalizedTags.map((tagName) => tagName.toLowerCase()),
    );
    const query = normalizeTagName(inputValue).toLowerCase();

    const matches: string[] = [];
    for (const tagName of dedupeTagNames(suggestions)) {
      const normalizedTagName = tagName.toLowerCase();
      if (selected.has(normalizedTagName)) {
        continue;
      }

      if (!query || normalizedTagName.includes(query)) {
        matches.push(tagName);
        if (matches.length === 8) break;
      }
    }

    return matches;
  }, [inputValue, normalizedTags, suggestions]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const addTag = (tagName: string) => {
    const cleaned = normalizeTagName(tagName);
    if (!cleaned) {
      return;
    }

    onChange(dedupeTagNames([...normalizedTags, cleaned]));
    setInputValue("");
    setIsOpen(false);
  };

  const removeTag = (tagName: string) => {
    const target = normalizeTagName(tagName).toLowerCase();
    onChange(
      normalizedTags.filter(
        (currentTag) => normalizeTagName(currentTag).toLowerCase() !== target,
      ),
    );
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {normalizedTags.length > 0 ? (
          normalizedTags.map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center gap-1.5 border border-black/15 bg-white px-2 py-1 text-xs font-semibold text-black dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
            >
              #{tagName}
              <button
                type="button"
                onClick={() => removeTag(tagName)}
                disabled={disabled}
                className="text-black/45 transition hover:text-black disabled:opacity-40 dark:text-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
                aria-label={`Remove ${tagName}`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
            No tags yet
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <input
            type="text"
            value={inputValue}
            aria-label={placeholder}
            onChange={(event) => {
              setInputValue(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (filteredSuggestions[0]) {
                  addTag(filteredSuggestions[0]);
                  return;
                }

                addTag(inputValue);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full border border-black/20 bg-white px-3 py-2 text-sm text-black placeholder-black/35 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#D5D5D5]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/35"
          />
          {isOpen && filteredSuggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden border border-black/15 bg-white shadow-lg dark:border-[#D5D5D5]/15 dark:bg-[#0C1222]">
              {filteredSuggestions.map((tagName) => (
                <button
                  key={tagName}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(tagName);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-black transition hover:bg-black/5 dark:text-[#D5D5D5] dark:hover:bg-white/5"
                >
                  {tagName}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => addTag(inputValue)}
          disabled={disabled || !normalizeTagName(inputValue)}
          className="border border-black/20 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#D5D5D5]/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:bg-white/5"
        >
          Add tag
        </button>
      </div>
    </div>
  );
}
