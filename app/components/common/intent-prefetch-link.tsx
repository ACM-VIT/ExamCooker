"use client";

import { useRef, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type IntentPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & {
  href: string;
};

export default function IntentPrefetchLink({
  onFocus,
  onMouseEnter,
  onTouchStart,
  href,
  ...props
}: IntentPrefetchLinkProps) {
  const router = useRouter();
  const prefetched = useRef<string | null>(null);

  const prefetchOnIntent = () => {
    if (prefetched.current === href) return;
    prefetched.current = href;
    router.prefetch(
      href,
      {
        kind: "full",
        onInvalidate: () => {
          if (prefetched.current === href) prefetched.current = null;
        },
      } as NonNullable<Parameters<typeof router.prefetch>[1]>,
    );
  };

  return (
    <Link
      {...props}
      href={href}
      onMouseEnter={(event) => {
        prefetchOnIntent();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchOnIntent();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetchOnIntent();
        onTouchStart?.(event);
      }}
    />
  );
}
