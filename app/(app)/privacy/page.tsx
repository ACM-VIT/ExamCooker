import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/app/(app)/legal/legal-page";

const UPDATED_AT = "May 1, 2026";

export const metadata: Metadata = {
    title: "Privacy Policy",
    alternates: { canonical: "/privacy" },
    robots: { index: true, follow: true },
};

const sections: LegalSection[] = [
    {
        id: "overview",
        title: "Overview",
        body: [
            "This Privacy Policy describes the categories of personal data and account-linked information that ExamCooker may collect, process, store, disclose, and retain in connection with the operation of the service.",
            "Access to most public study material does not require authentication. Certain features, including uploads, forum actions, saved activity, CLI access, and voice or AI-assisted functionality, require an account.",
        ],
    },
    {
        id: "data-we-store",
        title: "Data We Store",
        body: [
            {
                label: "Account data.",
                text: "When you sign in with Google or Apple, ExamCooker stores account records such as your user ID, email, name, profile image when provided, email verification time, role, provider account ID, and authentication fields needed to operate sign-in.",
            },
            {
                label: "Sessions and access.",
                text: "ExamCooker uses signed session cookies or tokens to keep you signed in. CLI access stores device authorization requests, device names when supplied, user codes, hashed device codes, token labels, status, last-used times, expiry, and revocation times.",
            },
            {
                label: "Contributions.",
                text: "Uploads and community features can store PDF metadata, file URLs, thumbnails, titles, course links, exam type, year, semester, campus, slot, answer-key status, forum posts, comments, votes, and tags.",
            },
            {
                label: "Saved activity.",
                text: "For signed-in users, the app can store bookmarks and view history for past papers, notes, forum posts, resources, and syllabi, including view counts and timestamps.",
            },
            {
                label: "AI and voice activity.",
                text: "Voice guide and PDF question-answering features can send prompts, questions, current page context, document URLs, document titles, model names, response text, timing, token counts, and error details to the configured AI and analytics services. The schema also supports saved study chat conversations and messages.",
            },
            {
                label: "Local preferences.",
                text: "Your browser can store small local preferences such as theme choice and upsell prompt state. These are stored on your device.",
            },
        ],
    },
    {
        id: "how-we-use-data",
        title: "How We Use Data",
        body: [
            "ExamCooker uses stored data to authenticate users, show the correct account state, operate uploads and moderation queues, display public study resources, keep bookmarks and view history, authorize CLI requests, and provide AI or voice-assisted study features.",
            "Analytics events may be used to understand feature usage, debug failures, measure performance, and improve search, uploads, PDF viewing, and assistant flows.",
        ],
    },
    {
        id: "third-parties",
        title: "Third Parties",
        body: [
            {
                label: "Google and Apple.",
                text: "Google OAuth and Sign in with Apple are used for sign-in.",
            },
            {
                label: "Hosting, database, and storage providers.",
                text: "Application data, public PDFs, thumbnails, and generated metadata are stored using the configured database, object storage, and upload-processing services.",
            },
            {
                label: "OpenAI.",
                text: "AI title generation, voice guide sessions, and PDF question-answering can send relevant prompts, document context, and file URLs to OpenAI.",
            },
            {
                label: "PostHog and Google Analytics.",
                text: "When configured, these services collect product analytics, page views, feature events, errors, and AI usage telemetry.",
            },
        ],
    },
    {
        id: "your-choices",
        title: "Your Choices",
        body: [
            "You can use public browsing features without an account. You can sign out to end the current session, clear local browser storage for device-side preferences, and revoke CLI access from the CLI flow when supported.",
            {
                text: (
                    <>
                        To request deletion of account-linked data, use the{" "}
                        <Link
                            href="/delete"
                            className="font-semibold text-black underline decoration-black/30 underline-offset-4 transition hover:decoration-black dark:text-[#D5D5D5] dark:decoration-[#D5D5D5]/30 dark:hover:text-[#3BF4C7] dark:hover:decoration-[#3BF4C7]"
                        >
                            account deletion request page
                        </Link>{" "}
                        or contact the maintainers through the official channels linked
                        in the site footer. Some public contributions may need to remain
                        available or be retained in moderation and backup records where
                        required to operate the service.
                    </>
                ),
            },
        ],
    },
    {
        id: "security-retention",
        title: "Security and Retention",
        body: [
            "ExamCooker limits write access to authenticated users and moderators where the feature requires it and uses access controls intended to protect account-linked records.",
            "Data is kept for as long as needed to operate the service, preserve public study resources, handle moderation, maintain security, and satisfy operational backup needs.",
        ],
    },
    {
        id: "changes",
        title: "Changes",
        body: [
            "This policy may change as ExamCooker adds or removes features. The updated date will change when the policy is revised.",
        ],
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            updatedAt={UPDATED_AT}
            sections={sections}
        />
    );
}
