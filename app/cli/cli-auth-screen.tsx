"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocationSearch } from "@/app/components/common/use-location-search";
import { approveCliDeviceAuthAction } from "@/app/cli/actions";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import ThemeToggle from "@/app/components/common/theme-toggle";
import CliCodeInput from "./cli-code-input";

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

type CliScreenState = {
  isSignedIn: boolean;
  request: CliLookupRequest | null;
  sessionEmail: string | null;
  state: CliState;
  userCode: string;
};

type CliScreenAction =
  | { type: "empty" }
  | { type: "checking"; userCode: string }
  | { type: "success"; approved: boolean; payload: CliLookupResponse }
  | { type: "invalid"; userCode: string };

function cliScreenReducer(
  state: CliScreenState,
  action: CliScreenAction,
): CliScreenState {
  switch (action.type) {
    case "empty":
      return {
        ...state,
        isSignedIn: false,
        request: null,
        sessionEmail: null,
        state: "idle",
        userCode: "",
      };
    case "checking":
      return {
        ...state,
        state: "checking",
        userCode: action.userCode,
      };
    case "success": {
      const nextState =
        action.approved && action.payload.state === "pending"
          ? "approved"
          : action.payload.state;

      return {
        isSignedIn: action.payload.isSignedIn,
        request: action.payload.request,
        sessionEmail: action.payload.sessionEmail,
        state: nextState,
        userCode: action.payload.userCode,
      };
    }
    case "invalid":
      return {
        ...state,
        request: null,
        state: "invalid",
        userCode: action.userCode,
      };
  }
}

function PrimaryActionButton({
  children,
  href,
  type = "button",
}: {
  children: React.ReactNode;
  href?: string;
  type?: "submit" | "button";
}) {
  const buttonClass =
    "relative inline-flex h-11 items-center justify-center border-2 border-black bg-[#3BF4C7] px-7 text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]";

  return (
    <div className="group relative inline-flex items-stretch">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#0A0F1C] dark:bg-[#3BF4C7]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#3BF4C7] opacity-0 blur-[60px] transition duration-200 group-hover:opacity-20 dark:hidden"
      />
      <div
        aria-hidden="true"
        className="duration-1000 transition dark:absolute dark:inset-0 dark:blur-[75px] dark:group-hover:duration-200 dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7]"
      />
      {href ? (
        <Link href={href} className={buttonClass}>
          {children}
        </Link>
      ) : (
        <button type={type} className={buttonClass}>
          {children}
        </button>
      )}
    </div>
  );
}

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
          <PrimaryActionButton type="submit">
            Approve device
          </PrimaryActionButton>
        </form>
      ) : (
        <PrimaryActionButton href={signInHref}>
          Sign in to continue
        </PrimaryActionButton>
      )}
    </>
  );
}

export default function CliAuthScreen() {
  const { replace } = useRouter();
  const locationSearch = useLocationSearch();
  const lookupIdRef = useRef(0);

  const searchParams = useMemo(
    () => new URLSearchParams(locationSearch),
    [locationSearch],
  );
  const initialCode = useMemo(
    () => normalizeUserCode(searchParams.get("code") ?? ""),
    [searchParams],
  );
  const initialApproved = searchParams.get("approved") === "1";

  const [screenState, dispatchScreenState] = useReducer(cliScreenReducer, {
    isSignedIn: false,
    request: null,
    sessionEmail: null,
    state: "idle",
    userCode: initialCode,
  });
  const { isSignedIn, request, sessionEmail, state, userCode } = screenState;

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
        replace(buildCliUrl(nextCode, approved), { scroll: false });
      }

      if (!nextCode) {
        dispatchScreenState({ type: "empty" });
        return;
      }

      const lookupId = lookupIdRef.current + 1;
      lookupIdRef.current = lookupId;

      dispatchScreenState({ type: "checking", userCode: nextCode });

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

        dispatchScreenState({ type: "success", approved, payload });
      } catch {
        if (lookupIdRef.current !== lookupId) {
          return;
        }

        dispatchScreenState({ type: "invalid", userCode: nextCode });
      }
    },
    [replace],
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
