"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { approveCliDeviceAuthAction } from "@/app/cli/actions";
import ExamCookerLogo from "@/app/components/common/ExamCookerLogo";
import ThemeToggle from "@/app/components/common/ThemeToggle";
import CliCodeInput from "./CliCodeInput";

type CliState =
  | "idle"
  | "checking"
  | "invalid"
  | "pending"
  | "approved"
  | "expired";

type CliLookupRequest = {
  userCode: string;
  deviceName: string | null;
  status: "PENDING" | "AUTHORIZED" | "DENIED";
  userEmail: string | null;
  isExpired: boolean;
};

type CliLookupResponse = {
  success: boolean;
  state: Exclude<CliState, "checking">;
  userCode: string;
  isSignedIn: boolean;
  sessionEmail: string | null;
  request: CliLookupRequest | null;
};

const PRIMARY_BTN =
  "inline-flex h-11 items-center justify-center rounded-lg bg-[#12715E] px-7 text-sm font-semibold text-white transition-transform duration-100 hover:scale-[1.01] active:translate-y-px dark:bg-[#3BF4C7] dark:text-[#0C1222]";

const GHOST_BTN =
  "inline-flex h-11 items-center justify-center rounded-lg border border-black/20 bg-transparent px-7 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white dark:border-[#D5D5D5]/20 dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7] dark:hover:bg-[#3BF4C7] dark:hover:text-[#0C1222]";

function normalizeUserCode(input: string) {
  const normalized = input.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

function buildCliUrl(userCode: string, approved = false) {
  if (!userCode) {
    return "/cli";
  }

  const params = new URLSearchParams({ code: userCode });
  if (approved) {
    params.set("approved", "1");
  }

  return `/cli?${params.toString()}`;
}

function StateIcon({ tone }: { tone: "ok" | "warn" }) {
  const wrap =
    tone === "ok"
      ? "border-[#12715E] text-[#12715E] dark:border-[#3BF4C7] dark:text-[#3BF4C7]"
      : "border-[#D97706] text-[#D97706] dark:border-[#FDBA74] dark:text-[#FDBA74]";
  return (
    <span
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full border ${wrap}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        {tone === "ok" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </>
        )}
      </svg>
    </span>
  );
}

function InlineAlert({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
}) {
  const wrap =
    tone === "error"
      ? "border-[#D97706]/30 bg-[#D97706]/8 text-[#9A3412] dark:border-[#FDBA74]/30 dark:bg-[#FDBA74]/10 dark:text-[#FDBA74]"
      : "border-[#D97706]/25 bg-[#D97706]/5 text-[#9A3412] dark:border-[#FDBA74]/25 dark:bg-[#FDBA74]/8 dark:text-[#FDBA74]";
  return (
    <div
      role="alert"
      className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13px] leading-snug text-balance ${wrap}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function PendingBlock({
  userCode,
  request,
  isSignedIn,
  sessionEmail,
  signInHref,
}: {
  userCode: string;
  request: CliLookupRequest;
  isSignedIn: boolean;
  sessionEmail: string | null;
  signInHref: string;
}) {
  const left = userCode.slice(0, 4);
  const right = userCode.slice(5, 9);
  const account =
    request.userEmail ||
    sessionEmail ||
    (isSignedIn ? "your account" : "Not connected");
  const device = request.deviceName || "ExamCooker CLI";

  return (
    <>
      <div className="flex items-center justify-center gap-5 font-mono text-3xl font-bold tabular-nums tracking-[0.28em] text-black dark:text-[#D5D5D5] sm:text-4xl">
        <span>{left}</span>
        <span>{right}</span>
      </div>

      <dl className="mx-auto grid w-full max-w-xs grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-black/55 dark:text-[#D5D5D5]/55">Device</dt>
        <dd className="truncate text-right font-medium">{device}</dd>
        <dt className="text-black/55 dark:text-[#D5D5D5]/55">Account</dt>
        <dd className="truncate text-right font-medium">{account}</dd>
      </dl>

      {isSignedIn ? (
        <form action={approveCliDeviceAuthAction}>
          <input type="hidden" name="userCode" value={request.userCode} />
          <button type="submit" className={PRIMARY_BTN}>
            Approve device
          </button>
        </form>
      ) : (
        <Link href={signInHref} className={PRIMARY_BTN}>
          Sign in to continue
        </Link>
      )}
    </>
  );
}

export default function CliAuthScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lookupIdRef = useRef(0);

  const initialCode = useMemo(
    () => normalizeUserCode(searchParams.get("code") ?? ""),
    [searchParams],
  );
  const initialApproved = searchParams.get("approved") === "1";

  const [state, setState] = useState<CliState>("idle");
  const [userCode, setUserCode] = useState(initialCode);
  const [request, setRequest] = useState<CliLookupRequest | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const runLookup = useCallback(
    async (
      rawUserCode: string,
      options?: {
        approved?: boolean;
        updateUrl?: boolean;
      },
    ) => {
      const nextCode = normalizeUserCode(rawUserCode);
      const approved = options?.approved ?? false;
      const updateUrl = options?.updateUrl ?? true;

      if (updateUrl) {
        router.replace(buildCliUrl(nextCode, approved), { scroll: false });
      }

      if (!nextCode) {
        setState("idle");
        setUserCode("");
        setRequest(null);
        setIsSignedIn(false);
        setSessionEmail(null);
        return;
      }

      const lookupId = lookupIdRef.current + 1;
      lookupIdRef.current = lookupId;

      setState("checking");
      setUserCode(nextCode);

      try {
        const response = await fetch(
          `/api/cli/device/lookup?code=${encodeURIComponent(nextCode)}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as CliLookupResponse;

        if (lookupIdRef.current !== lookupId) {
          return;
        }

        const nextState =
          approved && payload.state === "pending" ? "approved" : payload.state;

        setState(nextState);
        setUserCode(payload.userCode);
        setRequest(payload.request);
        setIsSignedIn(payload.isSignedIn);
        setSessionEmail(payload.sessionEmail);
      } catch {
        if (lookupIdRef.current !== lookupId) {
          return;
        }

        setState("invalid");
        setUserCode(nextCode);
        setRequest(null);
      }
    },
    [router],
  );

  useEffect(() => {
    void runLookup(initialCode, {
      approved: initialApproved,
      updateUrl: false,
    });
  }, [initialApproved, initialCode, runLookup]);

  const signInHref = `/api/auth/init?redirect=${encodeURIComponent(
    buildCliUrl(userCode || initialCode),
  )}`;

  const showInput =
    state === "idle" ||
    state === "checking" ||
    state === "invalid" ||
    state === "expired";

  const headings = showInput
    ? {
        title: "Authorize the CLI",
        subtitle: "Enter the code shown in your terminal.",
      }
    : state === "pending"
      ? {
          title: "Approve this device",
          subtitle: "This will let the CLI act on your account.",
        }
      : {
          title: "You're in.",
          subtitle: "Return to your terminal. It will pick up automatically.",
        };

  return (
    <main className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#C2E6EC] px-5 text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/"
          aria-label="ExamCooker home"
          className="mb-10 inline-flex items-center"
        >
          <ExamCookerLogo />
        </Link>

        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          {headings.title}
        </h1>
        <p className="mt-2 max-w-sm text-balance text-sm text-black/65 dark:text-[#D5D5D5]/60 sm:text-base">
          {headings.subtitle}
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-5">
          {showInput ? (
            <>
              <CliCodeInput
                initial={userCode}
                busy={state === "checking"}
                onSubmitCode={(code) => {
                  void runLookup(code);
                }}
              />

              <div
                aria-live="polite"
                className="flex min-h-[2.5rem] w-full items-start justify-center"
              >
                {/* {state === "checking" ? (
                  <p className="inline-flex items-center gap-2 text-sm text-black/55 dark:text-[#D5D5D5]/55">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Looking up that code
                  </p>
                ) : null} */}
                {state === "invalid" ? (
                  <InlineAlert tone="error">
                    That code was not recognized. Double-check it, or run{" "}
                    <code className="whitespace-nowrap rounded bg-black/5 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10">
                      examcooker auth login
                    </code>{" "}
                    again.
                  </InlineAlert>
                ) : null}
                {state === "expired" ? (
                  <InlineAlert tone="warn">
                    This code has expired. Run{" "}
                    <code className="whitespace-nowrap rounded bg-black/5 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10">
                      examcooker auth login
                    </code>{" "}
                    for a new one.
                  </InlineAlert>
                ) : null}
              </div>
            </>
          ) : null}

          {state === "pending" && request ? (
            <PendingBlock
              userCode={userCode}
              request={request}
              isSignedIn={isSignedIn}
              sessionEmail={sessionEmail}
              signInHref={signInHref}
            />
          ) : null}

          {state === "approved" ? (
            <>
              <StateIcon tone="ok" />
              <Link href="/" className={GHOST_BTN}>
                Back to ExamCooker
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function CliAuthScreenFallback() {
  return (
    <main className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#C2E6EC] px-5 text-black dark:bg-[#0C1222] dark:text-[#D5D5D5]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Link
          href="/"
          aria-label="ExamCooker home"
          className="mb-10 inline-flex items-center"
        >
          <ExamCookerLogo />
        </Link>

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Authorize the CLI
        </h1>
        <p className="mt-2 max-w-sm text-sm text-black/65 dark:text-[#D5D5D5]/60 sm:text-base">
          Loading the device login screen.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-5">
          <div
            aria-hidden="true"
            className="flex items-center justify-center gap-1.5 sm:gap-2"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center">
                {i === 4 ? <span className="w-3 sm:w-4" /> : null}
                <div className="h-12 w-9 rounded-lg border border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.05] sm:h-14 sm:w-11" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
