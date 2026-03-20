"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import FilterComp from "./filter/FilterComp";
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PAST_PAPER_EXAM_TAGS,
  PAST_PAPER_SLOT_TAGS,
} from "@/lib/pastPaperTags";

interface Option {
  id: string;
  label: string;
}

interface CheckboxOptions {
  courses?: Option[];
  slots?: Option[];
  examTypes?: Option[];
  years?: Option[];
}

interface DropdownProps {
  pageType: "notes" | "past_papers" | "resources" | "forum" | "favourites";
}

const SLOT_OPTIONS: Option[] = PAST_PAPER_SLOT_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

const EXAM_OPTIONS: Option[] = PAST_PAPER_EXAM_TAGS.map((tag) => ({
  id: tag,
  label: tag,
}));

const Dropdown: React.FC<DropdownProps> = ({ pageType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tags = searchParams
      .getAll("tags")
      .flatMap((tag) => tag.split(","))
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (tags.length > 0) {
      setSelectedTags(Array.from(new Set(tags)));
    } else {
      setSelectedTags([]);
    }
  }, [searchParams]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  const checkboxOptions: CheckboxOptions = {
    slots: SLOT_OPTIONS,
    examTypes: EXAM_OPTIONS,
  };

  const handleSelectionChange = useCallback(
    (category: keyof CheckboxOptions, selection: string[]) => {
      const newTags = Array.from(
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
      setSelectedTags(newTags);
      updateURL(newTags);
    },
    [selectedTags, checkboxOptions],
  );

  const updateURL = useCallback(
    (tags: string[]) => {
      const params = new URLSearchParams(searchParams);
      params.delete("tags");
      tags.forEach((tag) => params.append("tags", tag));
      const newURL = `/${pageType}?${params.toString()}`;
      router.push(newURL);
    },
    [searchParams, router, pageType],
  );

  return (
    <div
      className="relative w-full min-w-0 text-left md:w-auto md:min-w-fit"
      ref={dropdownRef}
    >
      <button
        onClick={toggleDropdown}
        className="inline-flex w-full items-center justify-center border-2 border-black bg-[#5FC4E7] px-4 py-2 text-lg font-bold dark:border-[#D5D5D5] dark:bg-[#7D7467]/20 md:w-auto"
      >
        Filter
        {isOpen ? (
          <FontAwesomeIcon icon={faCaretUp} className="ml-2" />
        ) : (
          <FontAwesomeIcon icon={faCaretDown} className="ml-2" />
        )}
      </button>
      <div
        className={`hide-scrollbar absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] overflow-auto border-2 border-black bg-[#4AD0FF] dark:border-white dark:bg-[#232530] md:w-auto md:min-w-[22rem] md:max-w-[1200px] ${isOpen ? "" : "hidden"}`}
      >
        <div className="flex flex-col items-stretch gap-1 p-1 md:flex-row md:items-start md:gap-4 md:p-2">
          {checkboxOptions.slots && (
            <div className="w-full font-bold md:w-auto">
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
          {checkboxOptions.examTypes && (
            <div className="w-full font-bold md:w-auto">
              <FilterComp
                title="Exam Types"
                options={checkboxOptions.examTypes}
                onSelectionChange={(selection) =>
                  handleSelectionChange("examTypes", selection)
                }
                selectedOptions={selectedTags.filter((tag) =>
                  checkboxOptions.examTypes!.some(
                    (option) => option.label === tag,
                  ),
                )}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dropdown;
