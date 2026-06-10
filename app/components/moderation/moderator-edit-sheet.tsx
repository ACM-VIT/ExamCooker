"use client";

import { X } from "lucide-react";
import { Drawer } from "vaul";
import { useEffect, useEffectEvent, type ReactNode } from "react";
import ModeratorPrimaryButton from "@/app/components/moderation/moderator-primary-button";
import { cn } from "@/lib/utils";

type ModeratorEditSheetProps = {
  cancelLabel?: string;
  children: ReactNode;
  errorMessage?: string | null;
  hasChanges: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onCancel?: () => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  saveLabel?: string;
  title: string;
  trigger?: ReactNode;
};

/**
 * Right-side drawer used by the moderator inline editors. The body slot is
 * passed through `children` so each editor can lay out its own form fields
 * while sharing a consistent header and footer.
 */
export default function ModeratorEditSheet({
  cancelLabel = "Cancel",
  children,
  errorMessage,
  hasChanges,
  isOpen,
  isSaving,
  onCancel,
  onOpenChange,
  onSave,
  saveLabel = "Save",
  title,
  trigger,
}: ModeratorEditSheetProps) {
  const saveFromShortcut = useEffectEvent(() => {
    if (hasChanges && !isSaving) {
      onSave();
    }
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        saveFromShortcut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      direction="right"
      handleOnly
      modal
      dismissible
    >
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px]" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh w-full flex-col outline-none",
            "bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]",
            "shadow-[-18px_0_60px_rgba(15,23,42,0.18)] dark:shadow-[-18px_0_70px_rgba(0,0,0,0.55)]",
            "sm:max-w-[420px]",
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
            <Drawer.Title className="truncate text-lg font-bold leading-tight tracking-tight text-black dark:text-[#D5D5D5]">
              {title}
            </Drawer.Title>
            <Drawer.Close asChild>
              <button
                type="button"
                aria-label="Close editor"
                className="inline-flex size-8 shrink-0 items-center justify-center border border-black/15 bg-white text-black/55 shadow-[0_2px_0_0_rgba(0,0,0,0.12)] transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/40 hover:bg-black/[0.04] hover:text-black hover:shadow-[0_3px_0_0_rgba(0,0,0,0.85)] focus:outline-none focus-visible:border-black/40 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55 dark:shadow-[0_2px_0_0_rgba(213,213,213,0.12)] dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.04] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_3px_0_0_rgba(59,244,199,0.45)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Drawer.Close>
          </header>

          <div
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
              <div className="flex flex-col gap-4">{children}</div>
            </div>

            <footer className="shrink-0 border-t border-black/10 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 dark:border-[#D5D5D5]/10">
              {errorMessage ? (
                <p className="mb-3 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-300">
                  {errorMessage}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex h-10 items-center border border-black/15 bg-white px-4 text-sm font-semibold text-black transition-all duration-150 ease-out hover:-translate-y-px hover:border-black/35 hover:bg-black/[0.03] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.85)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:hover:border-[#3BF4C7]/55 dark:hover:bg-white/[0.04] dark:hover:text-[#3BF4C7] dark:hover:shadow-[0_2px_0_0_rgba(59,244,199,0.45)]"
                >
                  {cancelLabel}
                </button>
                <ModeratorPrimaryButton
                  type="button"
                  onClick={onSave}
                  className="h-10"
                  disabled={isSaving || !hasChanges}
                >
                  {isSaving ? "Saving…" : saveLabel}
                </ModeratorPrimaryButton>
              </div>
            </footer>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
