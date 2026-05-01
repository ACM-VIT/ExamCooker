import type { Metadata } from "next";
import Link from "next/link";
import ExamCookerLogo from "@/app/components/common/exam-cooker-logo";
import DeleteAccountForm from "@/app/(app)/delete/delete-account-form";

export const metadata: Metadata = {
    title: "Delete Account",
    description: "Request deletion of your ExamCooker account and account-linked personal data.",
    alternates: { canonical: "/delete" },
    robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
                <header className="flex flex-col gap-8 border-b border-black/10 pb-10 dark:border-white/10">
                    <Link href="/" aria-label="ExamCooker home" className="w-fit">
                        <ExamCookerLogo />
                    </Link>
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-black tracking-normal text-black dark:text-[#D5D5D5] sm:text-5xl">
                            Delete Account
                        </h1>
                    </div>
                </header>

                <main>
                    <DeleteAccountForm />
                </main>
            </div>
        </div>
    );
}
