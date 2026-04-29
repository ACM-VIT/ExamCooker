import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/app/auth";
import { approveCliDeviceAuthAction } from "@/app/(app)/cli/actions";
import { getCliDeviceAuthRequestByUserCode } from "@/lib/cli/deviceAuth";
import { normalizeCliUserCode } from "@/lib/cli/tokens";

type CliPageSearchParams = {
  code?: string;
  approved?: string;
};

type CliApprovalRequest =
  | Awaited<ReturnType<typeof getCliDeviceAuthRequestByUserCode>>
  | null;

function statusCopy(input: {
  isSignedIn: boolean;
  request: CliApprovalRequest;
  approved: boolean;
}) {
  if (!input.request) {
    return {
      title: "Authorize ExamCooker CLI",
      description:
        "Paste the code shown in your terminal to connect the ExamCooker CLI to your account.",
    };
  }

  if (input.request.isExpired) {
    return {
      title: "Code expired",
      description:
        "This CLI login code has expired. Run `examcooker auth login` again to generate a fresh one.",
    };
  }

  if (input.request.status === "AUTHORIZED" || input.approved) {
    return {
      title: "CLI approved",
      description:
        "The ExamCooker CLI is authorized. Return to your terminal to finish login.",
    };
  }

  if (!input.isSignedIn) {
    return {
      title: "Sign in to continue",
      description:
        "Use your ExamCooker account first, then approve this CLI session from the same page.",
    };
  }

  return {
    title: "Approve CLI login",
    description:
      "This will let the ExamCooker CLI search papers, download files, and upload resources on your behalf.",
  };
}

function CliPageView(input: {
  userCode: string;
  approved: boolean;
  isSignedIn: boolean;
  request: CliApprovalRequest;
  sessionEmail: string | null;
}) {
  const copy = statusCopy({
    isSignedIn: input.isSignedIn,
    request: input.request,
    approved: input.approved,
  });
  const signInHref = `/api/auth/init?redirect=${encodeURIComponent(
    `/cli?code=${input.userCode}`,
  )}`;

  return (
    <main className="min-h-screen bg-[#F2F7F8] px-4 py-16 text-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#12715E]">
            ExamCooker CLI
          </p>
          <h1 className="text-4xl font-black tracking-tight">{copy.title}</h1>
          <p className="max-w-2xl text-base text-black/70">{copy.description}</p>
        </div>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-black/10 bg-[#F6FBFC] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                  Login code
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-[0.18em]">
                  {input.userCode || "---- ----"}
                </p>
                <p className="mt-3 text-sm text-black/60">
                  Run <code>examcooker auth login</code> in your terminal if you
                  need a new code.
                </p>
              </div>

              {input.request ? (
                <div className="rounded-2xl border border-black/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">
                    Pending device
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-black/55">Device</dt>
                      <dd className="font-medium">
                        {input.request.deviceName || "ExamCooker CLI"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-black/55">Status</dt>
                      <dd className="font-medium">
                        {input.request.isExpired
                          ? "Expired"
                          : input.request.status === "AUTHORIZED"
                            ? "Authorized"
                            : "Waiting for approval"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-black/55">Account</dt>
                      <dd className="font-medium">
                        {input.request.userEmail ||
                          input.sessionEmail ||
                          "Not connected yet"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <form action="/cli" className="rounded-2xl border border-black/10 p-5">
                  <label
                    htmlFor="code"
                    className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55"
                  >
                    Enter code
                  </label>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      id="code"
                      name="code"
                      autoComplete="off"
                      placeholder="ABCD-EFGH"
                      className="h-11 flex-1 rounded-xl border border-black/10 px-4 font-mono text-lg outline-none ring-0 placeholder:text-black/30"
                    />
                    <button
                      type="submit"
                      className="h-11 rounded-xl bg-black px-5 font-semibold text-white"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="space-y-4 rounded-2xl bg-black p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                What this unlocks
              </p>
              <ul className="space-y-3 text-sm text-white/85">
                <li>Search courses and past papers from your terminal.</li>
                <li>Download papers directly by paper ID.</li>
                <li>Upload PDFs through the same processor the web app uses.</li>
              </ul>
            </div>
          </div>

          {input.request &&
          !input.request.isExpired &&
          input.request.status !== "AUTHORIZED" ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {input.isSignedIn ? (
                <form action={approveCliDeviceAuthAction}>
                  <input
                    type="hidden"
                    name="userCode"
                    value={input.request.userCode}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#12715E] px-5 py-3 font-semibold text-white"
                  >
                    Approve CLI login
                  </button>
                </form>
              ) : (
                <Link
                  href={signInHref}
                  className="rounded-xl bg-[#12715E] px-5 py-3 font-semibold text-white"
                >
                  Sign in with Google
                </Link>
              )}
              <p className="text-sm text-black/55">
                {input.isSignedIn
                  ? `Signed in as ${input.sessionEmail ?? "your account"}.`
                  : "Sign in with your VIT account before approving this device."}
              </p>
            </div>
          ) : null}

          {(input.request?.status === "AUTHORIZED" || input.approved) &&
          !input.request?.isExpired ? (
            <div className="mt-6 rounded-2xl border border-[#12715E]/20 bg-[#ECFAF6] p-5 text-sm text-[#0D4F42]">
              The device is approved. Return to the terminal where you started{" "}
              <code>examcooker auth login</code>.
            </div>
          ) : null}

          {input.request?.isExpired ? (
            <div className="mt-6 rounded-2xl border border-[#D97706]/25 bg-[#FFF7ED] p-5 text-sm text-[#9A3412]">
              This code is no longer valid. Generate a new one from the CLI and
              open the updated link.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function CliPageFallback() {
  return (
    <CliPageView
      userCode=""
      approved={false}
      isSignedIn={false}
      request={null}
      sessionEmail={null}
    />
  );
}

async function CliPageContent({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<CliPageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParamsPromise) ?? {};
  const userCode = normalizeCliUserCode(resolvedSearchParams.code ?? "");
  const approved = resolvedSearchParams.approved === "1";
  const session = await auth();
  const request = userCode
    ? await getCliDeviceAuthRequestByUserCode(userCode)
    : null;

  return (
    <CliPageView
      userCode={userCode}
      approved={approved}
      isSignedIn={Boolean(session?.user?.id)}
      request={request}
      sessionEmail={session?.user?.email ?? null}
    />
  );
}

export default function CliPage({
  searchParams,
}: {
  searchParams?: Promise<CliPageSearchParams>;
}) {
  return (
    <Suspense fallback={<CliPageFallback />}>
      <CliPageContent searchParamsPromise={searchParams} />
    </Suspense>
  );
}
