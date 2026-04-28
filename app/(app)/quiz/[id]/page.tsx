import QuizClient from "./QuizClient";

type QuizPageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function QuizPage({ params }: QuizPageProps) {
    const { id } = await params;

    return <QuizClient quizConfig={id} />;
}
