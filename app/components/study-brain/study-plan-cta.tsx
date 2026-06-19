import Link from "next/link";

type Props = {
  courseCode?: string;
  examType?: string;
  slot?: string;
  variant?: "compact" | "panel";
};

function buildStudyPlanHref({ courseCode, examType, slot }: Props) {
  const params = new URLSearchParams();
  if (courseCode) params.set("course", courseCode);
  if (examType) params.set("exam", examType);
  if (slot) params.set("slot", slot);
  const query = params.toString();
  return `/study-plan${query ? `?${query}` : ""}`;
}

export default function StudyPlanCta({
  courseCode,
  examType,
  slot,
  variant = "panel",
}: Props) {
  const href = buildStudyPlanHref({ courseCode, examType, slot });

  if (variant === "compact") {
    return (
      <Link
        href={href}
        prefetch
        className="ec-press inline-flex h-9 items-center justify-center gap-1.5 border border-[#5FC4E7] bg-[#5FC4E7]/25 px-3 text-sm font-semibold text-black transition hover:border-black/30 hover:bg-[#5FC4E7]/40 dark:border-[#3BF4C7]/60 dark:bg-[#3BF4C7]/15 dark:text-[#3BF4C7] dark:hover:border-[#3BF4C7] sm:h-8"
      >
        Plan study
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      transitionTypes={["nav-forward"]}
      className="ec-card-lift group flex flex-col gap-4 border-2 border-[#5FC4E7] bg-[#5FC4E7] p-4 text-black dark:border-[#ffffff]/20 dark:bg-[#ffffff]/10 dark:text-[#D5D5D5] dark:lg:bg-[#0C1222] sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/70 dark:text-[#D5D5D5]/70">
          Study plan
        </span>
        <h3 className="mt-1.5 text-base font-bold leading-snug text-black dark:text-[#D5D5D5] sm:text-lg">
          Exam soon? Build a plan from the syllabus, slot reports, and papers.
        </h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-black/65 dark:text-[#D5D5D5]/65 sm:text-sm">
          Pick what is coming, choose how you study, and ExamCooker lines up the
          high-yield work first. It is not too late.
        </p>
      </div>
      <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start border border-black bg-white px-4 text-sm font-bold text-black transition group-hover:bg-black group-hover:text-white dark:border-[#3BF4C7] dark:bg-transparent dark:text-[#3BF4C7] dark:group-hover:bg-[#3BF4C7] dark:group-hover:text-[#0C1222] sm:self-auto">
        Plan my study
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
