import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/app/(app)/legal/legal-page";

const UPDATED_AT = "May 1, 2026";

export const metadata: Metadata = {
    title: "Terms of Service",
    alternates: { canonical: "/terms" },
    robots: { index: true, follow: true },
};

const sections: LegalSection[] = [
    {
        id: "acceptance",
        title: "Acceptance",
        body: [
            "These Terms of Service govern access to and use of ExamCooker. By accessing or using the service, you agree to be bound by these terms. If you do not agree, you must not use the service.",
            "ExamCooker is a student-built study resource. It is not an official examination system, grading system, university record, or institutional service.",
        ],
    },
    {
        id: "accounts",
        title: "Accounts",
        body: [
            "Some features require Google sign-in. You are responsible for the activity on your account and for keeping access to your Google account and CLI tokens secure.",
            "Moderators may receive additional permissions to review, approve, rename, tag, or remove submitted content.",
        ],
    },
    {
        id: "acceptable-use",
        title: "Acceptable Use",
        body: [
            "Use ExamCooker for lawful study, contribution, and academic preparation. Do not attack the service, scrape it abusively, bypass access controls, upload malware, submit spam, impersonate others, or interfere with other users.",
            "Do not upload private, confidential, illegal, or infringing material. Only upload files and text that you have the right to share with other students.",
        ],
    },
    {
        id: "contributions",
        title: "Your Contributions",
        body: [
            "When you upload notes, past papers, metadata, forum posts, comments, tags, or similar content, you give ExamCooker permission to host, process, display, index, moderate, transform, and distribute that content as part of the service.",
            "Public contributions may be visible to other users. ExamCooker may remove, edit, reclassify, or reject content to protect users, improve quality, comply with requests, or keep the repository usable.",
        ],
    },
    {
        id: "study-material",
        title: "Study Material",
        body: [
            "Study material, exam papers, syllabi, notes, course names, marks schemes, and related academic content remain the property of their respective authors, educators, publishers, institutions, or other rights holders.",
            "ExamCooker makes study material freely accessible for education, reference, preservation, and exam preparation under fair-use principles where applicable. If you believe material should not be hosted, contact the maintainers through the official channels linked in the site footer.",
            "ExamCooker is independent and is not affiliated with, endorsed by, sponsored by, or officially connected to any institution, department, faculty, publisher, examination authority, or rights holder whose material may appear on the service.",
            "ExamCooker tries to make study resources easier to find, but it does not guarantee that any paper, note, syllabus, solution, schedule, tag, title, or metadata is complete, current, or correct.",
            "Always verify important academic information with official course, faculty, or university sources before relying on it.",
        ],
    },
    {
        id: "ai-features",
        title: "AI Features",
        body: [
            "AI and voice features are study aids. They may misunderstand questions, documents, page context, or instructions, and their answers can be incomplete or wrong.",
            "Do not submit sensitive personal data through AI prompts or voice interactions. You remain responsible for checking AI-generated answers before using them.",
        ],
    },
    {
        id: "availability",
        title: "Availability",
        body: [
            "ExamCooker may change, pause, limit, or remove features at any time. The service can be unavailable because of maintenance, provider outages, abuse prevention, or infrastructure failures.",
            "CLI access, uploads, search, PDFs, analytics, storage, and AI features depend on external services and configured environment variables.",
        ],
    },
    {
        id: "liability",
        title: "Liability",
        body: [
            "ExamCooker is provided as-is for student convenience. To the maximum extent permitted by law, the maintainers are not liable for academic, technical, data, availability, or content-related losses from using the service.",
        ],
    },
    {
        id: "changes",
        title: "Changes",
        body: [
            "These terms may be updated when ExamCooker changes. Continued use of the service after updates means you accept the revised terms.",
            "Questions or requests can be sent to the maintainers through the official channels linked in the site footer.",
        ],
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            updatedAt={UPDATED_AT}
            sections={sections}
        />
    );
}
