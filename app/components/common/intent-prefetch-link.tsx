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
  href,
  ...props
}: IntentPrefetchLinkProps) {
  const router = useRouter();
  const prefetched = useRef(false);

  const prefetchOnIntent = () => {
    if (prefetched.current) return;
    prefetched.current = true;
    router.prefetch(
      href,
      {
        kind: "full",
        onInvalidate: () => {
          prefetched.current = false;
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
    />
  );
}
