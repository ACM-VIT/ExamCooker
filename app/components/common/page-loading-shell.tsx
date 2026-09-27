/** Shared fallback for form pages while their request data resolves. */
export default function PageLoadingShell() {
  return (
    <div className="min-h-screen bg-[#F5FAFD] px-3 py-6 dark:bg-transparent sm:px-6 lg:px-10" aria-hidden="true">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-black/10 pb-4 dark:border-white/10">
          <div className="ec-skeleton h-3 w-24 bg-black/10 dark:bg-white/10" />
          <div className="ec-skeleton h-8 w-2/3 max-w-sm bg-black/10 dark:bg-white/10" />
        </header>
        <div className="ec-skeleton flex flex-col gap-5 border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-[#0C1222]">
          <div className="h-4 w-1/3 bg-black/10 dark:bg-white/10" />
          <div className="h-11 bg-black/5 dark:bg-white/5" />
          <div className="h-11 bg-black/5 dark:bg-white/5" />
          <div className="h-11 bg-black/5 dark:bg-white/5" />
          <div className="h-9 w-28 bg-black/10 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
