"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import FilterComp from "./filter/FilterComp";
const PAST_PAPER_SLOT_TAGS = ["A1","A2","B1","B2","C1","C2","D1","D2","E1","E2","F1","F2","G1","G2"] as const;
const PAST_PAPER_EXAM_TAGS = ["CAT-1","CAT-2","FAT","Mid","Quiz","CIA"] as const;

interface Option {
  id: string;
  label: string;
}

interface CheckboxOptions {
  slots?: Option[];
  examTypes?: Option[];
}

interface DropdownProps {
  pageType: "notes" | "past_papers" | "resources" | "forum";
  searchString?: string;
}

const FILTER_SHEET_TITLES: Record<DropdownProps["pageType"], string> = {
  notes: "Filter notes",
  past_papers: "Filter past papers",
  resources: "Filter resources",
  forum: "Filter forum",
};

const SLOT_OPTIONS: Option[] = PAST_PAPER_SLOT_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

const EXAM_OPTIONS: Option[] = PAST_PAPER_EXAM_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

const SHEET_ANIMATION_MS = 280;

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
        <div className="w-full md:w-auto">
          <FilterComp
            title="Exam Types"
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
      {checkboxOptions.slots && (
        <div className="w-full md:w-auto">
          <FilterComp
            title="Slots"
            options={checkboxOptions.slots}
            onSelectionChange={(selection) =>
              handleSelectionChange("slots", selection)
            }
            selectedOptions={selectedTags.filter((tag) =>
              checkboxOptions.slots!.some((option) => option.label === tag),
            )}
            isSlotCategory={true}
          />
        </div>
      )}
    </>
  );
}

const Dropdown: React.FC<DropdownProps> = ({ pageType, searchString = "" }) => {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetShowing, setSheetShowing] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const router = useRouter();
  const desktopRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const mobileSheetTitle = FILTER_SHEET_TITLES[pageType];

  const checkboxOptions = useMemo<CheckboxOptions>(
    () => ({
      slots: SLOT_OPTIONS,
      examTypes: EXAM_OPTIONS,
    }),
    [],
  );

  const selectedTags = useMemo(() => {
    const tags = new URLSearchParams(searchString)
      .getAll("tags")
      .flatMap((tag) => tag.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);

    return tags.length > 0 ? Array.from(new Set(tags)) : [];
  }, [searchString]);

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

  const clearSheetTimers = useCallback(() => {
    if (openRafRef.current !== null) {
      cancelAnimationFrame(openRafRef.current);
      openRafRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMobileSheet = useCallback(() => {
    clearSheetTimers();
    setSheetMounted(true);
    setSheetOffset(0);
    document.body.style.overflow = "hidden";
    openRafRef.current = requestAnimationFrame(() => {
      openRafRef.current = requestAnimationFrame(() => {
        setSheetShowing(true);
        openRafRef.current = null;
      });
    });
  }, [clearSheetTimers]);

  const closeMobileSheet = useCallback(() => {
    clearSheetTimers();
    setSheetShowing(false);
    document.body.style.overflow = "";
    closeTimerRef.current = window.setTimeout(() => {
      setSheetMounted(false);
      setSheetOffset(0);
      touchStartYRef.current = null;
      closeTimerRef.current = null;
    }, SHEET_ANIMATION_MS);
  }, [clearSheetTimers]);

  useEffect(() => {
    return () => {
      clearSheetTimers();
      document.body.style.overflow = "";
    };
  }, [clearSheetTimers]);

  const updateURL = useCallback(
    (tags: string[]) => {
      const params = new URLSearchParams(searchString);
      params.delete("tags");
      tags.forEach((tag) => params.append("tags", tag));
      router.push(`/${pageType}?${params.toString()}`);
    },
    [pageType, router, searchString],
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
      closeMobileSheet();
    } else {
      setSheetOffset(0);
    }
    touchStartYRef.current = null;
  };

  const sheetTransform = sheetShowing
    ? `translateY(${sheetOffset}px)`
    : "translateY(100%)";

  return (
    <>
      <div
        className="relative hidden w-full min-w-0 text-left md:block md:w-auto md:min-w-fit"
        ref={desktopRef}
      >
        <button
          onClick={() => setDesktopOpen((open) => !open)}
          className="inline-flex h-11 w-full items-center justify-center border-2 border-black bg-[#5FC4E7] px-3 py-2 text-base font-semibold text-black dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] md:h-auto md:w-auto md:px-4 md:text-lg md:font-bold"
        >
          Filter
          <FontAwesomeIcon
            icon={desktopOpen ? faCaretUp : faCaretDown}
            className="ml-2"
          />
        </button>
        {desktopOpen && (
          <div className="absolute left-1/2 top-full z-50 mt-2 w-[min(28rem,90vw)] -translate-x-1/2 border-2 border-black bg-[#5FC4E7] shadow-xl dark:border-[#D5D5D5] dark:bg-[#0C1222]">
            <div className="flex flex-col items-stretch gap-1 p-2 md:flex-row md:items-start md:justify-center md:gap-4">
              <FilterSections
                checkboxOptions={checkboxOptions}
                handleSelectionChange={handleSelectionChange}
                selectedTags={selectedTags}
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full md:hidden">
        <button
          onClick={openMobileSheet}
          className="inline-flex h-12 w-full items-center justify-center border-2 border-black bg-[#5FC4E7] px-4 text-lg font-bold leading-none text-black dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5]"
        >
          Filter
          <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
        </button>
      </div>

      {sheetMounted && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            aria-label="Close filters"
            className={`absolute inset-0 bg-black/60 transition-opacity duration-[280ms] ease-out ${
              sheetShowing ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMobileSheet}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-[#5FC4E7] shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.35)] dark:bg-[#0C1222] no-scrollbar"
            style={{
              transform: sheetTransform,
              transition: touchStartYRef.current !== null
                ? "none"
                : `transform ${SHEET_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
            }}
          >
            <div
              className="flex justify-center px-5 pb-2 pt-3 touch-none"
              onTouchEnd={handleSheetTouchEnd}
              onTouchMove={handleSheetTouchMove}
              onTouchStart={handleSheetTouchStart}
            >
              <div className="h-1.5 w-12 rounded-full bg-black/30 dark:bg-[#D5D5D5]/30" />
            </div>
            <div className="px-5 pb-2 pt-1">
              <h2 className="text-left text-xl font-bold text-black dark:text-[#D5D5D5]">
                {mobileSheetTitle}
              </h2>
            </div>
            <div className="px-3 pb-4 pt-1">
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
