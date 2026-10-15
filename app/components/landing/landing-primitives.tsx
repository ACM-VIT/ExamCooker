import type { ReactNode } from "react";

export function GradientText({ children }: { children: ReactNode }) {
  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-tr to-[#27BAEC] from-[#253EE0]">
      {children}
    </span>
  );
}

export function WordBetweenLine({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex items-center justify-between gap-3 md:gap-6">
      <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
      <span className="text-center text-3xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl [@media(max-height:720px)]:lg:text-4xl [@media(max-height:560px)]:lg:text-3xl font-extrabold flex-shrink min-w-0 text-black dark:text-[#D5D5D5]">
        {children}
      </span>
      <div className="flex-grow border-t border-black dark:border-[#D5D5D5]"></div>
    </div>
  );
}
