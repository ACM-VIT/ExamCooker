import Link from "next/link";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";

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
        className="inline-flex h-9 items-center justify-center gap-1.5 border border-black/15 bg-black px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0D5875] dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7] dark:text-[#06101F] dark:hover:bg-[#7fffe0] sm:h-8"
      >
        <Clock3 className="size-3.5" aria-hidden />
        Plan study
      </Link>
    );
  }

  return (
    <section className="overflow-hidden border border-black/15 bg-white shadow-[0_4px_28px_-14px_rgba(0,0,0,0.25)] dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:shadow-[0_4px_28px_-14px_rgba(0,0,0,0.6)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center border border-black/10 bg-[#C2E6EC] text-black dark:border-[#3BF4C7]/30 dark:bg-[#0A1A2A] dark:text-[#3BF4C7]">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-black/45 dark:text-[#D5D5D5]/45">
              Exam soon?
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight text-black dark:text-[#D5D5D5]">
              Build a plan from your syllabus, slot intel, and papers.
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-black/65 dark:text-[#D5D5D5]/65">
              Pick what is coming, choose how you study, and let ExamCooker line up
              the high-yield stuff first. No calendar cosplay required.
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#0D5875] dark:border-[#3BF4C7] dark:bg-[#3BF4C7] dark:text-[#06101F] dark:hover:bg-[#7fffe0]"
        >
          Plan my study
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
