"use client";

import Link from "next/link";
import { useState } from "react";
import {
    invalidateAuthSessionCache,
    useGuestPrompt,
} from "@/app/components/auth-gate";

export default function DeleteAccountForm() {
    const { isAuthed, session, status } = useGuestPrompt();
    const [confirmed, setConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!confirmed || submitting) return;

        setSubmitting(true);
        setMessage(null);
        setError(null);

        try {
            const response = await fetch("/api/account/delete", {
                method: "POST",
                credentials: "same-origin",
            });

            if (!response.ok) {
                throw new Error("Deletion request failed");
            }

            setMessage("Your account has been deleted.");
            invalidateAuthSessionCache();
            const { signOut } = await import("next-auth/react");
            await signOut({ callbackUrl: "/" });
        } catch {
            setError("We could not delete your account right now. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (status === "loading") {
        return (
            <div className="h-40 max-w-2xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]" />
        );
    }

    if (!isAuthed) {
        const callbackUrl = encodeURIComponent("/delete");
        return (
            <div className="flex max-w-2xl flex-col gap-4 border border-black/10 bg-white/65 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">
                    Sign in to delete your ExamCooker account and account-linked data.
                </p>
                <Link
                    href={`/auth?callbackUrl=${callbackUrl}`}
                    className="inline-flex h-12 w-fit items-center justify-center border border-black bg-black px-5 text-sm font-bold text-white transition hover:bg-black/85 dark:border-white/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:hover:bg-white/15"
                >
                    Sign in to continue
                </Link>
            </div>
        );
    }

    return (
        <div className="flex max-w-2xl flex-col gap-5">
            <div className="border border-black/10 bg-white/65 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    Signed in as
                </p>
                <p className="mt-1 break-words text-sm text-black/65 dark:text-[#D5D5D5]/65">
                    {session?.user?.email ?? session?.user?.name ?? "Current account"}
                </p>
            </div>

            <div className="space-y-3 text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">
                <p>
                    Deleting your account removes your sign-in providers, active
                    sessions, saved activity, bookmarks, votes, CLI access, and saved
                    study chats.
                </p>
                <p>
                    Public contributions may remain available without your personal
                    account details so shared study material and discussions continue to
                    work for other students.
                </p>
            </div>

            <label className="flex items-start gap-3 text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">
                <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#253EE0]"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                    I understand this will delete my ExamCooker account and
                    account-linked personal data.
                </span>
            </label>

            {error && (
                <p className="border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-700 dark:text-red-200">
                    {error}
                </p>
            )}
            {message && (
                <p className="border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                    {message}
                </p>
            )}

            <button
                type="button"
                disabled={!confirmed || submitting}
                onClick={handleDelete}
                className="h-12 w-fit border border-red-700 bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-55 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-100 dark:hover:bg-red-500/30"
            >
                {submitting ? "Deleting account..." : "Delete account"}
            </button>
        </div>
    );
}
