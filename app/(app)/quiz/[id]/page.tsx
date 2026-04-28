import { Suspense } from "react";
import QuizClient from "./QuizClient";

type QuizPageProps = {
    params: Promise<{
        id: string;
    }>;
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

async function QuizContent({ params }: QuizPageProps) {
    const { id } = await params;

    return <QuizClient quizConfig={id} />;
}

export default function QuizPage({ params }: QuizPageProps) {
    return (
        <Suspense fallback={<QuizShell />}>
            <QuizContent params={params} />
        </Suspense>
    );
}
