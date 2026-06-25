"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FastForward,
  PenLine,
  Play,
  RotateCcw,
} from "lucide-react";
import { examTypeLabel } from "@/lib/exam-slug";
import { getCoursePastPapersPath } from "@/lib/seo";
import { GradientText } from "@/app/components/landing/landing";
import type { StudyPlan, StudyPlanSection } from "@/lib/study-brain/schemas";
import { formatMinutes } from "./sample-plan";
import { PLAN_TITLES, pickFrom } from "./copy";

type Priority = StudyPlanSection["priority"];
type TaskKind = StudyPlanSection["tasks"][number]["kind"];

type Props = {
  plan: StudyPlan;
  onReset: () => void;
};

const PRIORITY_META: Record<Priority, { label: string; card: string }> = {
  critical: {
    label: "Start here",
    card: "border-2 border-black/10 bg-white dark:border-[#D5D5D5]/12 dark:bg-white/[0.04]",
  },
  high: {
    label: "High yield",
    card: "border-2 border-[#5FC4E7]/70 bg-white dark:border-[#5FC4E7]/25 dark:bg-white/[0.03]",
  },
  medium: {
    label: "Worth a pass",
    card: "border border-black/12 bg-white dark:border-[#D5D5D5]/12 dark:bg-white/[0.02]",
  },
  low: {
    label: "Optional",
    card: "border border-dashed border-black/20 bg-transparent dark:border-[#D5D5D5]/15",
  },
};

const KIND_META: Record<TaskKind, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  read: { Icon: BookOpen, label: "Read" },
  watch: { Icon: Play, label: "Watch" },
  practice: { Icon: PenLine, label: "Practice" },
  revise: { Icon: RotateCcw, label: "Revise" },
  skim: { Icon: FastForward, label: "Skim" },
};

function humanJoin(parts: string[]): string {
  if (parts.length === 0) return "the syllabus";
  if (parts.length === 1) return parts[0] as string;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[1.75rem] font-black leading-none tabular-nums text-black dark:text-[#D5D5D5]">
        {value}
      </span>
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/50 dark:text-[#D5D5D5]/50">
        {label}
      </span>
    </div>
  );
}

export default function PlanView({ plan, onReset }: Props) {
  const { context, evidenceSummary } = plan;
  const examLabel = context.examType ? examTypeLabel(context.examType) : "";
  const title = pickFrom(PLAN_TITLES, context.courseCode);

  const builtFromParts: string[] = ["the syllabus"];
  if (evidenceSummary.pastPapersUsed > 0) {
    builtFromParts.push(
      `${evidenceSummary.pastPapersUsed} past paper${evidenceSummary.pastPapersUsed === 1 ? "" : "s"}`,
    );
  }
  if (evidenceSummary.earlierSlotSignalsUsed > 0) {
    builtFromParts.push(
      `${evidenceSummary.earlierSlotSignalsUsed} earlier-slot report${evidenceSummary.earlierSlotSignalsUsed === 1 ? "" : "s"}`,
    );
  }
  if (evidenceSummary.webResourcesUsed > 0) {
    builtFromParts.push(
      `${evidenceSummary.webResourcesUsed} resource${evidenceSummary.webResourcesUsed === 1 ? "" : "s"}`,
    );
  }

  return (
    <div className="sp-fade flex w-full max-w-3xl flex-col gap-7">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="ec-press inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-black/55 transition-colors hover:text-black dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5]"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} />
          Edit inputs
        </button>
        <span
          title="Sample plan. Live generation is coming soon."
          className="inline-flex items-center border border-black/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black/45 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5]/45"
        >
          Preview
        </span>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="sp-rule" />
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-black dark:text-[#D5D5D5] sm:text-[2.6rem] sm:leading-[1.05]">
          {title}
        </h1>
        <p className="text-base font-semibold text-black/70 dark:text-[#D5D5D5]/70">
          {context.courseTitle}
        </p>
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-black/45 dark:text-[#D5D5D5]/45">
          {context.courseCode}
          {examLabel ? ` · ${examLabel}` : ""}
          {context.slot ? ` · slot ${context.slot}` : ""}
        </p>
      </header>

      {/* Stat strip */}
      <section className="flex flex-col gap-3 border-y border-black/10 py-5 dark:border-[#D5D5D5]/10">
        <div className="flex flex-wrap items-end gap-x-9 gap-y-4">
          <Stat value={formatMinutes(plan.totalEstimatedMinutes)} label="to study" />
          <Stat value={evidenceSummary.syllabusTopicsUsed} label="topics" />
          <Stat value={evidenceSummary.pastPapersUsed} label="papers" />
          {evidenceSummary.earlierSlotSignalsUsed > 0 ? (
            <Stat value={evidenceSummary.earlierSlotSignalsUsed} label="slot reports" />
          ) : null}
          <Stat value={evidenceSummary.webResourcesUsed} label="resources" />
        </div>
        <p className="text-sm text-black/55 dark:text-[#D5D5D5]/55">
          Built from {humanJoin(builtFromParts)}. Highest priority first.
        </p>
      </section>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {plan.sections.map((section, index) => {
          const meta = PRIORITY_META[section.priority];
          const isCritical = section.priority === "critical";
          return (
            <article
              key={`${section.topicTitle}-${index}`}
              style={{ ["--sp-i" as string]: index }}
              className={`sp-rise relative flex flex-col gap-3 overflow-hidden p-4 sm:p-5 ${meta.card}`}
            >
              {isCritical ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#253EE0] to-[#27BAEC]"
                />
              ) : null}
              <div className={`flex items-start justify-between gap-3 ${isCritical ? "pl-2.5" : ""}`}>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider">
                    {isCritical ? (
                      <GradientText>{meta.label}</GradientText>
                    ) : (
                      <span className="text-black/45 dark:text-[#D5D5D5]/45">
                        {meta.label}
                      </span>
                    )}
                  </p>
                  <h3 className="mt-1.5 text-lg font-bold leading-snug text-black dark:text-[#D5D5D5]">
                    {section.topicTitle}
                  </h3>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-black/65 dark:text-[#D5D5D5]/65">
                  {formatMinutes(section.estimatedMinutes)}
                </span>
              </div>

              <p className={`text-sm leading-relaxed text-black/65 dark:text-[#D5D5D5]/65 ${isCritical ? "pl-2.5" : ""}`}>
                {section.reason}
              </p>

              {section.evidence.length > 0 ? (
                <div className={`flex flex-wrap gap-1.5 ${isCritical ? "pl-2.5" : ""}`}>
                  {section.evidence.map((item, evidenceIndex) => (
                    <span
                      key={`${item.label}-${evidenceIndex}`}
                      className="inline-flex items-center bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-black/65 dark:bg-white/[0.06] dark:text-[#D5D5D5]/70"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <ul className={`mt-1 flex flex-col divide-y divide-black/[0.07] dark:divide-white/[0.07] ${isCritical ? "pl-2.5" : ""}`}>
                {section.tasks.map((task, taskIndex) => {
                  const kind = KIND_META[task.kind];
                  const Icon = kind.Icon;
                  return (
                    <li
                      key={`${task.title}-${taskIndex}`}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center border border-black/15 text-black/55 dark:border-[#D5D5D5]/15 dark:text-[#D5D5D5]/60">
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {task.url ? (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-black underline-offset-2 hover:underline dark:text-[#D5D5D5]"
                          >
                            {task.title}
                            <ExternalLink className="size-3 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                            {task.title}
                          </span>
                        )}
                        <p className="text-xs text-black/45 dark:text-[#D5D5D5]/45">
                          {kind.label}
                          {task.source ? `, ${task.source}` : ""}
                          {task.skipIfShortOnTime ? ", skippable" : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-black/55 dark:text-[#D5D5D5]/55">
                        {task.estimatedMinutes}m
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>

      {/* Warnings */}
      {plan.warnings.length > 0 ? (
        <section className="border-l-2 border-black/20 pl-4 dark:border-[#D5D5D5]/20">
          {plan.warnings.map((warning) => (
            <p
              key={warning}
              className="py-0.5 text-sm text-black/55 dark:text-[#D5D5D5]/55"
            >
              {warning}
            </p>
          ))}
        </section>
      ) : null}

      {/* After the exam */}
      <section className="border border-dashed border-black/20 p-4 dark:border-[#D5D5D5]/15">
        <p className="text-sm font-bold text-black dark:text-[#D5D5D5]">
          After the exam
        </p>
        <p className="mt-1 text-sm leading-relaxed text-black/60 dark:text-[#D5D5D5]/60">
          You can mark what actually came up from a list of topics. It takes a
          few seconds and helps the plan for students in later slots.
        </p>
      </section>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href={getCoursePastPapersPath(context.courseCode)}
          prefetch
          className="sp-cta-sheen group ec-press inline-flex h-11 items-center gap-2 border-2 border-black bg-[#5FC4E7] px-4 text-sm font-bold text-black transition-colors hover:border-transparent hover:bg-gradient-to-r hover:from-[#253EE0] hover:to-[#27BAEC] hover:text-white dark:border-[#5FC4E7]/40 dark:bg-[#5FC4E7]/12 dark:text-[#D5D5D5]"
        >
          Open {context.courseCode} past papers
          <ArrowLeft className="size-4 rotate-180 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="ec-press inline-flex h-11 items-center border border-black/20 px-4 text-sm font-semibold text-black/70 transition-colors hover:border-black/50 hover:text-black dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5]/70 dark:hover:border-[#D5D5D5]/50 dark:hover:text-[#D5D5D5]"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
