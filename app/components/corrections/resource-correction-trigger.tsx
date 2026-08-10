"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Flag, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useState,
  useTransition,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Drawer } from "vaul";
import { submitContentCorrectionReport } from "@/app/actions/content-correction-reports";
import { useGuestPrompt } from "@/app/components/auth-gate";
import { useToast } from "@/app/components/ui/use-toast";
import type { CorrectionReportCategory } from "@/lib/ai/content-correction-types";

type Props = {
  resourceId: string;
  resourceType: "note" | "pastPaper";
};

const categories: Array<{
  value: CorrectionReportCategory;
  label: string;
}> = [
  { value: "wrong_title", label: "Wrong title" },
  { value: "wrong_course", label: "Wrong course" },
  { value: "wrong_exam_details", label: "Wrong exam details" },
  { value: "wrong_resource_type", label: "Wrong type (notes/paper)" },
  { value: "duplicate", label: "Duplicate upload" },
  { value: "other", label: "Something else" },
];

function useMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

const TriggerButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>(function TriggerButton({ className, ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label="Suggest a correction"
      title="Suggest a correction"
      className={`ec-icon-button relative ml-1.5 inline-flex size-8 translate-y-0.5 items-center justify-center border border-transparent align-baseline text-black/30 transition hover:border-black/10 hover:bg-white/45 hover:text-black/65 focus-visible:border-black/25 focus-visible:text-black/70 dark:text-[#D5D5D5]/30 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-[#D5D5D5]/70 dark:focus-visible:border-white/25 dark:focus-visible:text-[#D5D5D5]/75 ${className ?? ""}`}
    >
      <Flag className="size-3.5" strokeWidth={1.6} aria-hidden />
    </button>
  );
});

// The site's primary button: a backing layer behind a bordered button that
// slides up-left on hover to reveal it (see the upload buttons).
function SubmitButton({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <span className="group relative inline-flex h-10 w-fit items-stretch">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[#0A0F1C] group-has-[:disabled]:hidden dark:bg-[#3BF4C7]"
      />
      <button
        type="submit"
        disabled={disabled}
        className="relative inline-flex h-full items-center gap-2 border-2 border-black bg-[#3BF4C7] px-4 text-sm font-bold text-black transition duration-150 enabled:group-hover:-translate-x-1 enabled:group-hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:enabled:group-hover:border-[#3BF4C7] dark:enabled:group-hover:text-[#3BF4C7]"
      >
        {children}
      </button>
    </span>
  );
}

const fieldLabel = "mb-1.5 block text-sm font-semibold";
const fieldInput =
  "ec-focus-ring w-full border border-black/25 bg-white text-sm outline-none placeholder:text-black/35 dark:border-white/25 dark:bg-white/5 dark:placeholder:text-[#D5D5D5]/35";

export default function ResourceCorrectionTrigger({
  resourceId,
  resourceType,
}: Props) {
  const isMobile = useMobileSheet();
  const { requireAuth } = useGuestPrompt();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] =
    useState<CorrectionReportCategory>("wrong_title");
  const [description, setDescription] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setCategory("wrong_title");
    setDescription("");
    setSuggestedValue("");
    setError(null);
    setSubmitted(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) window.setTimeout(reset, 200);
  };

  const submit = () => {
    if (!requireAuth("report a correction")) return;
    if (description.trim().length < 10) {
      setError("Please add a little more detail so the report can be verified.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitContentCorrectionReport({
          resourceId,
          resourceType,
          category,
          description,
          suggestedValue: suggestedValue || undefined,
        });
        setSubmitted(true);
        toast({ title: "Correction sent for verification." });
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "The report could not be sent.",
        );
      }
    });
  };

  const form = submitted ? (
    <div className="py-6 text-center sm:py-4">
      <span className="mx-auto flex size-10 items-center justify-center border-2 border-black bg-[#3BF4C7] text-black dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]">
        <Check className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-bold">Report received</h3>
      <p className="mx-auto mt-1 max-w-xs text-sm text-black/60 dark:text-[#D5D5D5]/60">
        It will be checked against the PDF shortly.
      </p>
      <button
        type="button"
        onClick={() => handleOpenChange(false)}
        className="ec-press mt-5 inline-flex h-10 items-center border border-black/30 px-5 text-sm font-semibold transition hover:border-black dark:border-white/30 dark:hover:border-white"
      >
        Done
      </button>
    </div>
  ) : (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <fieldset>
        <legend className={fieldLabel}>What needs fixing?</legend>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={category === item.value}
              onClick={() => {
                setCategory(item.value);
                if (item.value === "duplicate" || item.value === "other") {
                  setSuggestedValue("");
                }
              }}
              className={`min-h-10 border px-3 py-2 text-left text-sm transition active:translate-y-px ${
                category === item.value
                  ? "border-black bg-black font-semibold text-[#C2E6EC] dark:border-[#3BF4C7] dark:bg-[#3BF4C7]/10 dark:text-[#3BF4C7]"
                  : "border-black/25 text-black/70 hover:border-black dark:border-white/25 dark:text-[#D5D5D5]/70 dark:hover:border-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={fieldLabel}>What did you notice?</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          maxLength={1200}
          placeholder="For example: the paper says CAT-2 on the first page, not CAT-1."
          className={`${fieldInput} resize-none px-3 py-2.5 leading-6`}
        />
      </label>

      {category !== "duplicate" && category !== "other" ? (
        <label className="block">
          <span className={fieldLabel}>
            What should it be? <span className="font-normal text-black/50 dark:text-[#D5D5D5]/50">(optional)</span>
          </span>
          <input
            value={suggestedValue}
            onChange={(event) => setSuggestedValue(event.target.value)}
            maxLength={500}
            className={`${fieldInput} h-10 px-3`}
          />
        </label>
      ) : null}

      {error ? (
        <p className="border-l-2 border-red-500 pl-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          disabled={isPending}
          className="ec-press inline-flex h-10 items-center border border-black/30 px-4 text-sm font-normal transition hover:border-black disabled:opacity-50 dark:border-white/30 dark:hover:border-white"
        >
          Cancel
        </button>
        <SubmitButton disabled={isPending}>
          {isPending ? "Sending…" : "Send report"}
        </SubmitButton>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={handleOpenChange} modal>
        <Drawer.Trigger asChild><TriggerButton /></Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[3px]" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.35rem] border border-b-0 border-black/15 bg-[#C2E6EC] pt-3 text-black outline-none dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]"
          >
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-black/12 dark:bg-white/18" aria-hidden />
            <div className="flex shrink-0 items-center justify-between gap-3 px-4">
              <Drawer.Title className="text-[17px] font-semibold">Suggest a correction</Drawer.Title>
              <Drawer.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex size-10 items-center justify-center rounded-full text-black/50 hover:bg-black/[0.07] dark:text-[#D5D5D5]/55 dark:hover:bg-white/[0.08]"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </Drawer.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-4">
              {form}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild><TriggerButton /></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-2 border-[#5FC4E7] bg-white p-5 text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.15)] outline-none dark:border-white/20 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.05)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">Suggest a correction</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="ec-icon-button flex size-9 items-center justify-center text-black/45 hover:text-black dark:text-[#D5D5D5]/45 dark:hover:text-[#D5D5D5]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{form}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
