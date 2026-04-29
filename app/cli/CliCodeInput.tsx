"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

const LENGTH = 8;
const VALID = /[A-Z0-9]/g;

function clean(input: string) {
  return input.toUpperCase().match(VALID)?.join("").slice(0, LENGTH) ?? "";
}

function formatCode(value: string) {
  if (value.length <= 4) return value;
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

export default function CliCodeInput({
  initial = "",
  busy = false,
  onSubmitCode,
}: {
  initial?: string;
  busy?: boolean;
  onSubmitCode?: (code: string) => void;
}) {
  const [chars, setChars] = useState<string[]>(() => {
    const seed = clean(initial);
    return Array.from({ length: LENGTH }, (_, i) => seed[i] ?? "");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

  const value = chars.join("");
  const filled = value.length === LENGTH;
  const formatted = useMemo(() => formatCode(value), [value]);
  const submitting = busy || isSubmitting;

  useEffect(() => {
    const seed = clean(initial);
    setChars((prev) => {
      const next = Array.from({ length: LENGTH }, (_, i) => seed[i] ?? "");
      if (prev.join("") === next.join("")) {
        return prev;
      }
      return next;
    });

    if (!seed) {
      refs.current[0]?.focus();
    }
  }, [initial]);

  function focusAt(i: number) {
    const target = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    target?.focus();
    target?.select();
  }

  function fillFrom(start: number, source: string) {
    if (!source) return;
    setChars((prev) => {
      const next = [...prev];
      for (let k = 0; k < source.length && start + k < LENGTH; k += 1) {
        next[start + k] = source[k];
      }
      return next;
    });
    focusAt(Math.min(LENGTH - 1, start + source.length));
  }

  function handleChange(i: number) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const cleaned = clean(e.target.value);
      if (cleaned.length === 0) {
        setChars((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
        return;
      }
      if (cleaned.length === 1) {
        setChars((prev) => {
          const next = [...prev];
          next[i] = cleaned;
          return next;
        });
        focusAt(i + 1);
        return;
      }
      fillFrom(i, cleaned);
    };
  }

  function handleKeyDown(i: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (chars[i]) {
          setChars((prev) => {
            const next = [...prev];
            next[i] = "";
            return next;
          });
        } else if (i > 0) {
          setChars((prev) => {
            const next = [...prev];
            next[i - 1] = "";
            return next;
          });
          focusAt(i - 1);
        }
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowLeft") {
        focusAt(i - 1);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        focusAt(i + 1);
        e.preventDefault();
      } else if (e.key === "Enter" && filled) {
        formRef.current?.requestSubmit();
      }
    };
  }

  function handlePaste(i: number) {
    return (e: ClipboardEvent<HTMLInputElement>) => {
      const cleaned = clean(e.clipboardData.getData("text"));
      if (!cleaned) return;
      e.preventDefault();
      const start = cleaned.length >= LENGTH ? 0 : i;
      fillFrom(start, cleaned);
    };
  }

  function clear() {
    setChars(Array.from({ length: LENGTH }, () => ""));
    focusAt(0);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!filled || submitting) {
      e.preventDefault();
      return;
    }

    e.preventDefault();

    if (onSubmitCode) {
      onSubmitCode(formatted);
      return;
    }

    setIsSubmitting(true);

    const params = new URLSearchParams({ code: formatted });
    window.location.assign(`/cli?${params.toString()}`);
  }

  return (
    <form
      ref={formRef}
      action="/cli"
      method="get"
      onSubmit={handleSubmit}
      aria-busy={submitting}
      className="flex w-full flex-col items-center gap-3"
    >
      <input type="hidden" name="code" value={formatted} />
      <div
        role="group"
        aria-label="Login code"
        className="flex w-full items-center justify-center gap-1.5 sm:gap-2"
      >
        {Array.from({ length: LENGTH }).map((_, i) => (
          <Fragment key={i}>
            {i === 4 ? <span aria-hidden="true" className="w-3 sm:w-4" /> : null}
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1}
              disabled={submitting}
              aria-label={`Character ${i + 1}`}
              value={chars[i]}
              onChange={handleChange(i)}
              onKeyDown={handleKeyDown(i)}
              onPaste={handlePaste(i)}
              onFocus={(e) => e.target.select()}
              className="h-12 w-9 rounded-lg border border-black/15 bg-white text-center font-mono text-lg font-semibold uppercase text-black caret-[#12715E] outline-none transition-colors focus:border-[#12715E] focus:ring-2 focus:ring-[#12715E]/20 dark:border-white/15 dark:bg-white/[0.05] dark:text-[#D5D5D5] dark:caret-[#3BF4C7] dark:focus:border-[#3BF4C7] dark:focus:ring-[#3BF4C7]/30 sm:h-14 sm:w-11 sm:text-xl"
            />
          </Fragment>
        ))}
      </div>

      <button
        type="submit"
        disabled={!filled || submitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-sm font-semibold text-white transition-[transform,opacity] duration-100 hover:enabled:scale-[1.01] active:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3BF4C7] dark:text-[#0C1222]"
      >
        {submitting ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Checking
          </>
        ) : (
          "Continue"
        )}
      </button>

      <button
        type="button"
        onClick={clear}
        disabled={submitting || value.length === 0}
        aria-hidden={value.length === 0}
        className={`text-xs font-medium text-black/55 underline-offset-4 transition-opacity hover:text-black hover:underline dark:text-[#D5D5D5]/55 dark:hover:text-[#D5D5D5] ${
          value.length === 0 ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        Clear code
      </button>
    </form>
  );
}
