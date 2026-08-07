"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { examTypeLabel } from "@/lib/exam-slug";
import type { ComposerConfig } from "./sample-plan";

type Props = {
  config: ComposerConfig;
  onDone: () => void;
};

export default function Generating({ config, onDone }: Props) {
  const examLabel = config.examType ? examTypeLabel(config.examType) : "";

  const stages = useMemo(() => {
    const list: string[] = ["Matching the syllabus"];
    list.push(
      config.course.paperCount > 0
        ? `Reading past papers${examLabel ? ` for ${examLabel}` : ""}`
        : "Reading the syllabus modules",
    );
    list.push("Checking earlier slots");
    list.push("Lining up resources");
    list.push("Ordering by priority");
    return list;
  }, [config.course.paperCount, examLabel]);

  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = reduce ? 130 : 720;
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      index += 1;
      setActive(index);
      if (index < stages.length) {
        timer = setTimeout(tick, step);
      } else {
        timer = setTimeout(onDone, reduce ? 120 : 540);
      }
    };

    timer = setTimeout(tick, step);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(100, Math.round((active / stages.length) * 100));

  return (
    <div className="sp-fade flex min-h-[52vh] w-full max-w-md flex-col justify-center gap-7 py-12">
      <header className="flex flex-col gap-1.5">
        <div className="sp-rule" />
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.01em] text-black dark:text-[#D5D5D5] sm:text-3xl">
          Building your plan
        </h1>
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-black/50 dark:text-[#D5D5D5]/50">
          {config.course.code}
          {examLabel ? ` · ${examLabel}` : ""}
          {config.slot ? ` · slot ${config.slot}` : ""}
        </p>
      </header>

      <div
        className="h-[3px] w-full overflow-hidden bg-black/10 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-[#253EE0] to-[#27BAEC] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="flex flex-col">
        {stages.map((label, index) => {
          const done = index < active;
          const isActive = index === active;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 border-l-2 py-3 pl-4 transition-colors ${
                done || isActive
                  ? "border-[#5FC4E7] dark:border-[#5FC4E7]/40"
                  : "border-black/10 dark:border-[#D5D5D5]/10"
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center border-2 transition-colors ${
                  done
                    ? "border-black bg-[#5FC4E7] text-black dark:border-[#5FC4E7]/50 dark:bg-[#5FC4E7]/15 dark:text-[#D5D5D5]"
                    : isActive
                      ? "border-black/60 text-black dark:border-[#D5D5D5]/50 dark:text-[#D5D5D5]"
                      : "border-black/15 text-transparent dark:border-[#D5D5D5]/15"
                }`}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : isActive ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                ) : null}
              </span>
              <span
                className={`text-base font-semibold transition-colors ${
                  done
                    ? "text-black dark:text-[#D5D5D5]"
                    : isActive
                      ? "text-black dark:text-[#D5D5D5]"
                      : "text-black/35 dark:text-[#D5D5D5]/35"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
