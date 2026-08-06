import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/app/(app)/legal/legal-page";

const UPDATED_AT = "May 6, 2026";

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
                text: "When you sign in with Google or Apple, ExamCooker stores account records such as your user ID, email, name, profile image when provided, email verification time, role, provider account ID, OAuth scope, token type, token expiry, and authentication tokens or fields needed to operate sign-in.",
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
        id: "payments",
        title: "Payments",
        body: [
            "ExamCooker does not currently sell paid digital content, subscriptions, premium features, physical goods, or bundled physical and digital purchases in the app.",
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
        id: "google-user-data",
        title: "Google User Data",
        body: [
            {
                label: "Data accessed.",
                text: "If you choose Google sign-in, ExamCooker asks Google for basic account identity information: your Google account email address, display name, profile image or avatar when Google provides one, email verification status, and Google account identifier. The app also receives OAuth authentication data needed to create and maintain your ExamCooker session, such as the provider account ID, OAuth scope, token type, token expiry, and sign-in tokens.",
            },
            {
                label: "Data usage.",
                text: "ExamCooker uses Google user data only to authenticate you, create or find your ExamCooker account, show your account identity inside the app, prevent duplicate accounts, protect account access, maintain sessions, support account deletion, and associate your uploads, forum actions, bookmarks, view history, CLI tokens, and moderation actions with the correct signed-in user.",
            },
            {
                label: "Data storage.",
                text: "Google user data used for sign-in is stored in ExamCooker's authentication database for as long as your account is active or as long as needed for security, moderation, backups, and service operation. You can request deletion of account-linked data from the account deletion page.",
            },
            {
                label: "Data sharing.",
                text: "ExamCooker does not sell Google user data and does not use it for advertising. Google user data is shared only with service providers that operate ExamCooker, such as hosting, database, storage, analytics, and security infrastructure, and only as needed to run, secure, debug, and improve the service.",
            },
            {
                label: "Limited Google access.",
                text: "ExamCooker does not request access to Google Drive, Gmail, Google Calendar, Google Contacts, or other Google API content. Google sign-in is used only for account authentication and basic profile identity.",
            },
        ],
    },
    {
        id: "third-party-processors",
        title: "Third-Party Processors",
        body: [
            "ExamCooker uses third-party processors to provide authentication, hosting, storage, analytics, AI features, upload processing, security, and operational infrastructure. These processors are permitted to process personal data only for the service purposes described in this policy.",
            {
                label: "Authentication providers.",
                text: "Google and Apple process sign-in requests and return account identity information when you choose those sign-in methods.",
            },
            {
                label: "Hosting, database, and object storage providers.",
                text: "Microsoft Azure processes hosting, application runtime, logs, backups, uploaded PDFs, thumbnails, generated metadata, and public study resources. Azure Blob Storage and Google Cloud Storage process stored file assets. CockroachDB processes account records, authentication records, uploads metadata, bookmarks, view history, moderation records, and other application database records.",
            },
            {
                label: "Upload-processing services.",
                text: "Configured upload processors may receive uploaded PDFs and related metadata to validate files, generate thumbnails, extract or normalize document data, and return file URLs or processed results.",
            },
            {
                label: "AI providers.",
                text: "OpenAI may process prompts, questions, selected document context, document URLs, voice-session data, model settings, generated responses, timing, usage, and error information when AI or voice features are used.",
            },
            {
                label: "Analytics providers.",
                text: "PostHog and Google Analytics may process page views, product events, device and browser information, approximate location derived from network data, session identifiers, signed-in user identifiers when configured, performance data, and error or AI usage telemetry.",
            },
            {
                label: "Security, cache, and rate-limit providers.",
                text: "Microsoft Azure Managed Redis may process pseudonymized network identifiers, request metadata, timestamps, counters, cached values, and abuse-prevention or rate-limit signals when Redis-backed security, cache, or rate-limit features are configured.",
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
                        To delete account-linked data, use the{" "}
                        <Link
                            href="/delete"
                            className="font-semibold text-black underline decoration-black/30 underline-offset-4 transition hover:decoration-black dark:text-[#D5D5D5] dark:decoration-[#D5D5D5]/30 dark:hover:text-[#3BF4C7] dark:hover:decoration-[#3BF4C7]"
                        >
                            account deletion page
                        </Link>{" "}
                        in the app. Some public contributions may remain available
                        without your personal account details or be retained in backup
                        records where required to operate the service.
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
