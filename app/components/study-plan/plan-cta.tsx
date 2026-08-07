import Link from "next/link";
import { CTA_HOOKS, pickFrom } from "./copy";

type Props = {
  courseCode?: string;
  examType?: string;
  slot?: string;
  variant?: "compact" | "panel";
};

function buildHref({ courseCode, examType, slot }: Props) {
  const params = new URLSearchParams();
  if (courseCode) params.set("course", courseCode);
  if (examType) params.set("exam", examType);
  if (slot) params.set("slot", slot);
  const query = params.toString();
  return `/study-plan${query ? `?${query}` : ""}`;
}

export default function PlanCta({
  courseCode,
  examType,
  slot,
  variant = "panel",
}: Props) {
  const href = buildHref({ courseCode, examType, slot });
  const seed = courseCode ?? "exam-cooker";

  if (variant === "compact") {
    return (
      <Link
        href={href}
        prefetch
        className="ec-press inline-flex h-9 items-center border border-black/20 bg-[#5FC4E7]/40 px-3 text-sm font-semibold text-black transition hover:border-black/50 hover:bg-[#5FC4E7] dark:border-[#D5D5D5]/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:hover:border-[#D5D5D5]/40 sm:h-8"
      >
        Make a plan
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      className="ec-card-lift group flex flex-col gap-4 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-snug sm:text-lg">
          {pickFrom(CTA_HOOKS, seed)}
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-black/60 dark:text-[#D5D5D5]/60 sm:text-sm">
          Say what is coming and how you study. ExamCooker orders the high-yield
          work first, using the syllabus, past papers, and earlier slots.
        </p>
      </div>
      <span className="inline-flex h-10 shrink-0 items-center gap-2 self-start border border-black bg-white px-4 text-sm font-bold text-black transition group-hover:bg-black group-hover:text-white dark:border-[#D5D5D5]/30 dark:bg-transparent dark:text-[#D5D5D5] dark:group-hover:border-[#D5D5D5]/50 dark:group-hover:bg-white/10 sm:self-auto">
        Make a plan
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
