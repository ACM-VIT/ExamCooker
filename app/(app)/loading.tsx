function LoadingCard({ index }: { index: number }) {
    return (
        <div
            className="flex min-h-28 flex-col gap-3 border-2 border-[#5FC4E7] bg-[#5FC4E7]/70 p-4 dark:border-white/15 dark:bg-white/10"
            style={{ opacity: 1 - index * 0.025 }}
        >
            <span className="h-3 w-16 bg-black/10 dark:bg-white/10" />
            <span className="h-4 w-full bg-black/10 dark:bg-white/10" />
            <span className="h-4 w-3/4 bg-black/10 dark:bg-white/10" />
            <span className="mt-auto h-7 w-12 bg-black/10 dark:bg-white/10" />
        </div>
    );
}

export default function Loading() {
    return (
        <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-3 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
                <section className="flex flex-col gap-5">
                    <div className="h-8 w-56 max-w-full bg-black/10 dark:bg-white/10 sm:h-14 sm:w-96" />
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-5">
                        <span className="h-8 bg-black/10 dark:bg-white/10 sm:w-28" />
                        <span className="h-8 bg-black/10 dark:bg-white/10 sm:w-28" />
                        <span className="h-8 bg-black/10 dark:bg-white/10 sm:w-28" />
                    </div>
                </section>
                <div className="h-12 border border-black/15 bg-white/80 dark:border-white/15 dark:bg-white/10" />
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <LoadingCard key={index} index={index} />
                    ))}
                </section>
            </div>
        </div>
    );
}
