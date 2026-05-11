"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModeratorPrimaryButtonProps = {
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/**
 * Primary action button used for Save/CTA inside moderator surfaces.
 * Mirrors the brutalist "+New"-style upload button: black backdrop offset
 * underneath, mint glow on hover, button shifts up-left to reveal the shadow.
 */
const ModeratorPrimaryButton = forwardRef<
  HTMLButtonElement,
  ModeratorPrimaryButtonProps
>(function ModeratorPrimaryButton(
  { children, className, disabled, type = "button", ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "group relative inline-flex shrink-0 items-stretch",
        disabled && "pointer-events-none opacity-55",
        className,
      )}
    >
      {!disabled ? (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-black dark:bg-[#3BF4C7]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[#3BF4C7] opacity-0 blur-[60px] transition duration-200 group-hover:opacity-20 dark:hidden"
          />
          <div
            aria-hidden
            className="duration-1000 transition dark:absolute dark:inset-0 dark:blur-[75px] dark:group-hover:duration-200 dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7]"
          />
        </>
      ) : null}
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        {...props}
        className="relative inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap border-2 border-black bg-[#3BF4C7] px-4 text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 disabled:cursor-not-allowed dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7]"
      >
        {children}
      </button>
    </div>
  );
});

export default ModeratorPrimaryButton;
