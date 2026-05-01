import { Suspense } from "react";
import type { Metadata } from "next";
import QuizClient from "./quiz-client";
import QuizLandingClient from "./quiz-landing-client";

type QuizSearchParams = {
    weeks?: string;
    numQ?: string;
    time?: string;
    course?: string;
};

function QuizShell() {
    return (
        <div
            className="flex min-h-screen items-center justify-center bg-[#F5FAFD] dark:bg-transparent"
            aria-hidden="true"
        >
            <div className="h-8 w-8 animate-spin border-2 border-black border-t-transparent dark:border-[#D5D5D5] dark:border-t-transparent" />
        </div>
    );
}

async function QuizPageContent({
    searchParamsPromise,
}: {
    searchParamsPromise: Promise<QuizSearchParams> | undefined;
}) {
    const params = (await searchParamsPromise) ?? {};
    const { weeks, numQ, time, course } = params;

    if (!weeks || !numQ || !time || !course) {
        return <QuizLandingClient />;
    }

    const quizConfig = new URLSearchParams({
        weeks,
        numQ,
        time,
        course,
    }).toString();

    return <QuizClient quizConfig={quizConfig} />;
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams?: Promise<QuizSearchParams>;
}): Promise<Metadata> {
    const params = (await searchParams) ?? {};
    const hasSession = !!(
        params.weeks &&
        params.numQ &&
        params.time &&
        params.course
    );
    return {
        title: hasSession ? "Practice quiz" : "Quiz",
        alternates: { canonical: "/quiz" },
        robots: { index: !hasSession, follow: true },
    };
}

export default function QuizPage({
    searchParams,
}: {
    searchParams?: Promise<QuizSearchParams>;
}) {
    return (
        <Suspense fallback={<QuizShell />}>
            <QuizPageContent searchParamsPromise={searchParams} />
        </Suspense>
    );
}
