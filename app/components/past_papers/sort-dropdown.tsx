"use client";

import React, { addTransitionType, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

const OPTIONS = [
  { value: "seasonal", label: "Current exam first" },
  { value: "year_desc", label: "Year (newest first)" },
  { value: "year_asc", label: "Year (oldest first)" },
  { value: "recent", label: "Recently uploaded" },
] as const;

type SortValue = (typeof OPTIONS)[number]["value"];
type PopupLayout = { side: "top" | "bottom"; maxHeight: number };

function revealActiveOption(menu: HTMLUListElement) {
  const active = menu.querySelector<HTMLElement>("[data-active='true']");
  if (!active) return;
  const menuTop = menu.getBoundingClientRect().top + menu.clientTop;
  const option = active.getBoundingClientRect();
  if (option.top < menuTop) {
    menu.scrollTop -= menuTop - option.top;
  } else if (option.bottom > menuTop + menu.clientHeight) {
    menu.scrollTop += option.bottom - menuTop - menu.clientHeight;
  }
}

export default function SortDropdown({
  basePath,
  value,
  searchString,
}: {
  basePath: string;
  value: SortValue;
  searchString: string;
}) {
  const { replace } = useRouter();
  const [, startTransition] = useTransition();
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const typeaheadRef = useRef({ text: "", time: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = OPTIONS.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [popupLayout, setPopupLayout] = useState<PopupLayout | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const viewport = window.visualViewport;

    const updateLayout = () => {
      const bounds = trigger.getBoundingClientRect();
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      // Leave room for the popup gap (4px) and a viewport inset (8px).
      const below = Math.max(0, viewportBottom - bounds.bottom - 12);
      const above = Math.max(0, bounds.top - viewportTop - 12);
      const fullHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
      const side = below < fullHeight && above > below ? "top" : "bottom";
      const maxHeight = Math.floor(side === "top" ? above : below);
      setPopupLayout((previous) => previous?.side === side && previous.maxHeight === maxHeight
        ? previous
        : { side, maxHeight });
    };

    function handleScroll(event: Event) {
      if (event.target !== menu) updateLayout();
    }

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", handleScroll, true);
    viewport?.addEventListener("resize", updateLayout);
    viewport?.addEventListener("scroll", updateLayout);
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", handleScroll, true);
      viewport?.removeEventListener("resize", updateLayout);
      viewport?.removeEventListener("scroll", updateLayout);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (isOpen && menuRef.current) revealActiveOption(menuRef.current);
  }, [isOpen, activeIndex, popupLayout]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        typeaheadRef.current.text = "";
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    typeaheadRef.current.text = "";
  }

  function choose(next: SortValue) {
    close();
    triggerRef.current?.focus();
    if (next === value) return;

    const params = new URLSearchParams(searchString);
    if (next === "seasonal") {
      params.delete("sort");
    } else {
      params.set("sort", next);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      addTransitionType("filter-results");
      replace(qs ? `${basePath}?${qs}` : basePath);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        typeaheadRef.current.text = "";
        setActiveIndex(isOpen
          ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + OPTIONS.length) % OPTIONS.length
          : selectedIndex);
        setIsOpen(true);
        return;
      case "Home":
      case "End":
        event.preventDefault();
        typeaheadRef.current.text = "";
        setActiveIndex(event.key === "Home" ? 0 : OPTIONS.length - 1);
        setIsOpen(true);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) choose(OPTIONS[activeIndex].value);
        else {
          setActiveIndex(selectedIndex);
          setIsOpen(true);
        }
        return;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
      case "Tab":
        close();
        return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const now = Date.now();
    const key = event.key.toLowerCase();
    const previous = now - typeaheadRef.current.time < 500 ? typeaheadRef.current.text : "";
    const text = previous === key ? key : previous + key;
    typeaheadRef.current = { text, time: now };
    const currentIndex = isOpen ? activeIndex : selectedIndex;
    const startIndex = currentIndex + (text.length === 1 ? 1 : 0);
    for (let offset = 0; offset < OPTIONS.length; offset++) {
      const index = (startIndex + offset) % OPTIONS.length;
      if (OPTIONS[index].label.toLowerCase().startsWith(text)) {
        setActiveIndex(index);
        setIsOpen(true);
        break;
      }
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative z-30 inline-flex items-center gap-2 text-xs"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <span id={`${id}-label`} className="font-semibold uppercase tracking-wider text-black/55 dark:text-[#D5D5D5]/55">
        Sort
      </span>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? `${id}-options` : undefined}
          aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
          onClick={() => {
            if (isOpen) close();
            else {
              setActiveIndex(selectedIndex);
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="inline-flex items-center justify-between gap-3 border border-black/25 bg-white px-2 py-1 text-xs font-semibold text-black transition-colors hover:border-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:border-[#D5D5D5]/25 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/50 dark:focus-visible:ring-[#3BF4C7]"
        >
          <span>{OPTIONS[selectedIndex].label}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
        {/* DOM options share the site's theme instead of a browser-native popup. */}
        {isOpen && (
          <ul
            ref={menuRef}
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            data-side={popupLayout?.side ?? "bottom"}
            style={{ maxHeight: popupLayout?.maxHeight }}
            className={`no-scrollbar absolute left-0 w-max min-w-full overflow-y-auto overscroll-contain border border-black/15 bg-white p-1 text-black shadow-[0_18px_45px_rgba(15,23,42,0.18)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${
              popupLayout?.side === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {OPTIONS.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-active={index === activeIndex}
                onPointerMove={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
                className={`flex min-h-9 cursor-pointer items-center gap-2 px-2.5 py-2 text-xs font-semibold ${
                  index === activeIndex ? "bg-black/5 dark:bg-white/[0.06]" : ""
                } ${option.value === value ? "text-black dark:text-[#3BF4C7]" : ""}`}
              >
                {option.label}
                <span className="ml-auto inline-flex size-3.5 shrink-0 items-center justify-center">
                  {option.value === value && <Check className="size-3.5" aria-hidden="true" />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
