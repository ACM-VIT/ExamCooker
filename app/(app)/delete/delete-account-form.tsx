export default function DeleteAccountForm() {
    return (
        <form className="flex max-w-2xl flex-col gap-5">
            <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    Account email
                </span>
                <input
                    type="email"
                    required
                    autoComplete="email"
                    className="h-12 border border-black/15 bg-white/70 px-4 text-base text-black outline-none transition focus:border-black dark:border-white/15 dark:bg-white/5 dark:text-[#D5D5D5] dark:focus:border-[#3BF4C7]"
                />
            </label>

            <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    Name
                </span>
                <input
                    type="text"
                    autoComplete="name"
                    className="h-12 border border-black/15 bg-white/70 px-4 text-base text-black outline-none transition focus:border-black dark:border-white/15 dark:bg-white/5 dark:text-[#D5D5D5] dark:focus:border-[#3BF4C7]"
                />
            </label>

            <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    Anything else we should know
                </span>
                <textarea
                    rows={5}
                    className="resize-y border border-black/15 bg-white/70 px-4 py-3 text-base leading-7 text-black outline-none transition focus:border-black dark:border-white/15 dark:bg-white/5 dark:text-[#D5D5D5] dark:focus:border-[#3BF4C7]"
                />
            </label>

            <label className="flex items-start gap-3 text-sm leading-6 text-black/70 dark:text-[#D5D5D5]/70">
                <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#253EE0]"
                    required
                />
                <span>
                    I understand this is a request to delete my ExamCooker account and
                    account-linked personal data.
                </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
                <button
                    type="button"
                    className="h-12 border border-black bg-black px-5 text-sm font-bold text-white transition hover:bg-black/85 dark:border-white/20 dark:bg-white/10 dark:text-[#D5D5D5] dark:hover:bg-white/15"
                >
                    Request deletion
                </button>
            </div>
        </form>
    );
}
