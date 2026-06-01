"use client";

import { Pencil } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type EditorToggleButtonProps = {
  ariaLabel?: string;
  className?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "aria-label"
>;

/**
 * Small icon-only edit button for moderator surfaces. Sits inline inside an
 * `<h1>` so the pen renders next to the title text without claiming a new
 * line. Subtle lift + colour change on hover for a tactile feel without
 * stealing focus from the title.
 */
const EditorToggleButton = forwardRef<HTMLButtonElement, EditorToggleButtonProps>(
  function EditorToggleButton({ ariaLabel, className, ...props }, ref) {
    const label = ariaLabel ?? "Edit";

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        {...props}
        className={`group/edit ml-1.5 inline-flex h-7 w-7 shrink-0 translate-y-[-0.05em] items-center justify-center align-middle text-black/30 transition-all duration-150 ease-out hover:-translate-y-[0.18em] hover:text-black focus:outline-none focus-visible:text-black dark:text-[#D5D5D5]/30 dark:hover:text-[#3BF4C7] dark:focus-visible:text-[#3BF4C7] ${className ?? ""}`}
      >
        <Pencil
          className="size-3.5 transition-transform duration-150 ease-out group-hover/edit:rotate-[-8deg]"
          aria-hidden
        />
      </button>
    );
  },
);

export default EditorToggleButton;
