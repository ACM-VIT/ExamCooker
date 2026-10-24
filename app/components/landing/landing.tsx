import type { ComponentProps } from "react";
import Image from "@/app/components/common/app-image";
import ArrowRight from "@/public/LandingPage/arrow-right.svg";
import Link from "next/link";

export function LandingPageCard({
  title,
  content,
  imagePath,
  altOfImage,
  href,
}: {
  title: string;
  content: string;
  imagePath: ComponentProps<typeof Image>["src"];
  altOfImage: string;
  href: string;
}) {
  return (
    <Link href={href} className="relative overflow-hidden group">
      <div className="hidden lg:block absolute left-0 top-0 size-[150px] rounded-full bg-none transition duration-1000 group-hover:duration-200 group-hover:bg-[#3BF4C7]"></div>
      <div className="block lg:hidden absolute left-0 top-0 size-[100px] rounded-full bg-[#3BF4C7]"></div>
      <div className="hidden lg:block absolute right-0 bottom-0 size-[150px] rounded-full transition duration-1000 group-hover:duration-200 md:bg-none md:group-hover:bg-[#82BEE9]"></div>
      <div className="block lg:hidden absolute right-0 bottom-0 size-[100px] rounded-full bg-[#82BEE9]"></div>

      <div className="relative flex size-full flex-col justify-between border border-[#5FC4E7]/20 bg-[#5FC4E7]/20 p-4 backdrop-blur-[100px] dark:border-[#7D7467]/20 dark:bg-[#7D7467]/20 md:p-5">
        <div className="flex min-h-[260px] w-full flex-col items-center justify-center gap-5 text-center sm:min-h-[220px] sm:flex-row sm:items-center sm:justify-between sm:text-left lg:h-[200px] lg:min-h-0 xl:h-[220px] [@media(max-height:720px)]:lg:h-[140px] [@media(max-height:560px)]:lg:h-[110px]">
          <Image
            src={imagePath}
            alt={altOfImage}
            className="h-24 w-auto shrink-0 dark:invert-[.835] dark:hue-rotate-180 sm:h-28 md:h-32 lg:h-[78%]"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[18rem] md:max-w-none">
            <span className="text-lg font-extrabold leading-tight md:text-2xl lg:text-2xl xl:text-3xl">
              {title}
            </span>
            <span className="text-sm leading-relaxed md:text-sm xl:text-base">
              {content}
            </span>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <Image
            src={ArrowRight}
            alt="ArrowRight"
            className="h-[18px] md:h-[24px] lg:h-[28px] dark:invert-[0.835]"
          />
        </div>
      </div>
    </Link>
  );
}
