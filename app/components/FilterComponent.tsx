"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter, useSearchParams } from "next/navigation";
import FilterComp from "./filter/FilterComp";
import { PAST_PAPER_EXAM_TAGS } from "@/lib/pastPaperTags";

interface Option {
  id: string;
  label: string;
}

interface CheckboxOptions {
  examTypes?: Option[];
}

interface DropdownProps {
  pageType: "notes" | "past_papers" | "resources" | "forum" | "favourites";
}

const FILTER_SHEET_TITLES: Record<DropdownProps["pageType"], string> = {
  notes: "Filters",
  past_papers: "Filters",
  resources: "Filters",
  forum: "Filters",
  favourites: "Filters",
};

const EXAM_OPTIONS: Option[] = PAST_PAPER_EXAM_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

function FilterSections({
  checkboxOptions,
  handleSelectionChange,
  selectedTags,
}: {
  checkboxOptions: CheckboxOptions;
  handleSelectionChange: (
    category: keyof CheckboxOptions,
    selection: string[],
  ) => void;
  selectedTags: string[];
}) {
  return (
    <>
      {checkboxOptions.examTypes && (
        <div className="w-full font-bold md:w-auto">
          <FilterComp
            title=""
            options={checkboxOptions.examTypes}
            onSelectionChange={(selection) =>
              handleSelectionChange("examTypes", selection)
            }
            selectedOptions={selectedTags.filter((tag) =>
              checkboxOptions.examTypes!.some((option) => option.label === tag),
            )}
          />
        </div>
      )}
    </>
  );
}

const Dropdown: React.FC<DropdownProps> = ({ pageType }) => {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const desktopRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const mobileSheetTitle = FILTER_SHEET_TITLES[pageType];

  const checkboxOptions = useMemo<CheckboxOptions>(
    () => ({
      examTypes: EXAM_OPTIONS,
    }),
    [],
  );

  useEffect(() => {
    const tags = searchParams
      .getAll("tags")
      .flatMap((tag) => tag.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSelectedTags(tags.length > 0 ? Array.from(new Set(tags)) : []);
  }, [searchParams]);

  useEffect(() => {
    if (!desktopOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        desktopRef.current &&
        !desktopRef.current.contains(event.target as Node)
      ) {
        setDesktopOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [desktopOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      setSheetOffset(0);
      touchStartYRef.current = null;
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const updateURL = useCallback(
    (tags: string[]) => {
      const params = new URLSearchParams(searchParams);
      params.delete("tags");
      tags.forEach((tag) => params.append("tags", tag));
      router.push(`/${pageType}?${params.toString()}`);
    },
    [pageType, router, searchParams],
  );

  const handleSelectionChange = useCallback(
    (category: keyof CheckboxOptions, selection: string[]) => {
      const nextTags = Array.from(
        new Set([
          ...selectedTags.filter(
            (tag) =>
              !checkboxOptions[category]?.some(
                (option) => option.label === tag,
              ),
          ),
          ...selection,
        ]),
      );

      setSelectedTags(nextTags);
      updateURL(nextTags);
    },
    [checkboxOptions, selectedTags, updateURL],
  );

  const handleSheetTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) return;

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    setSheetOffset(Math.max(0, currentY - touchStartYRef.current));
  };

  const handleSheetTouchEnd = () => {
    if (sheetOffset > 80) {
      setMobileOpen(false);
    } else {
      setSheetOffset(0);
    }
    touchStartYRef.current = null;
  };

  return (
    <>
      <div
        className="relative hidden w-full min-w-0 text-left md:block md:w-auto md:min-w-fit"
        ref={desktopRef}
      >
        <button
          onClick={() => setDesktopOpen((open) => !open)}
          className="inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#5FC4E7] px-3 py-2 text-base font-semibold dark:border-[#D5D5D5] dark:bg-[#7D7467]/20 md:h-auto md:w-auto md:px-4 md:text-lg md:font-bold"
        >
          Filter
          <FontAwesomeIcon
            icon={desktopOpen ? faCaretUp : faCaretDown}
            className="ml-2"
          />
        </button>
        {desktopOpen && (
          <div className="hide-scrollbar absolute left-0 top-full z-50 mt-2 min-w-[18rem] max-w-[1200px] overflow-x-hidden border-2 border-black bg-[#4AD0FF] shadow-xl dark:border-[#3BF4C7]/50 dark:bg-[#0C1222]">
            <div className="flex flex-col items-stretch gap-1 p-2 md:flex-row md:items-start md:gap-4">
              <FilterSections
                checkboxOptions={checkboxOptions}
                handleSelectionChange={handleSelectionChange}
                selectedTags={selectedTags}
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-auto md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-11 items-center justify-center border-2 border-black bg-[#5FC4E7] px-8 text-base font-semibold dark:border-[#D5D5D5] dark:bg-[#7D7467]/20"
        >
          Filter
          <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="hide-scrollbar absolute inset-x-0 bottom-0 max-h-[72vh] overflow-y-auto overscroll-contain bg-[#4AD0FF] shadow-2xl transition-transform duration-200 dark:bg-[#0C1222]"
            style={{ transform: `translateY(${sheetOffset}px)` }}
          >
            <div
              className="px-5 pb-2 pt-3"
              onTouchEnd={handleSheetTouchEnd}
              onTouchMove={handleSheetTouchMove}
              onTouchStart={handleSheetTouchStart}
            >
              <div className="mx-auto h-1.5 w-14 bg-black/20 dark:bg-white/25" />
            </div>
            <div className="px-5 pb-2 pt-1">
              <h2 className="text-center text-xl font-bold text-black dark:text-[#D5D5D5]">
                {mobileSheetTitle}
              </h2>
            </div>
            <div className="px-3 pb-6">
              <FilterSections
                checkboxOptions={checkboxOptions}
                handleSelectionChange={handleSelectionChange}
                selectedTags={selectedTags}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dropdown;
