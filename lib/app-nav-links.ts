import HomeIcon from "@/public/assets/home.svg";
import PastPapersIcon from "@/public/assets/past-papers-icon.svg";
import NotesIcon from "@/public/assets/notes-icon.svg";
import SyllabusIcon from "@/public/assets/syllabus-logo.svg";
import ResourcesIcon from "@/public/assets/book-icon.svg";

export type AppNavLink = {
  href: string;
  label: string;
  svgSource: string | { src: string; width?: number; height?: number };
  alt: string;
  matches?: (pathname: string | null) => boolean;
};

export const APP_NAV_LINKS: AppNavLink[] = [
  { href: "/", label: "Home", svgSource: HomeIcon, alt: "Home" },
  {
    href: "/past_papers",
    label: "Papers",
    svgSource: PastPapersIcon,
    alt: "Papers",
    matches: (pathname) =>
      pathname === "/past_papers" || pathname?.startsWith("/past_papers/") === true,
  },
  {
    href: "/notes",
    label: "Notes",
    svgSource: NotesIcon,
    alt: "Notes",
    matches: (pathname) =>
      pathname === "/notes" || pathname?.startsWith("/notes/") === true,
  },
  {
    href: "/syllabus",
    label: "Syllabus",
    svgSource: SyllabusIcon,
    alt: "Syllabus",
    matches: (pathname) =>
      pathname === "/syllabus" || pathname?.startsWith("/syllabus/") === true,
  },
  {
    href: "/resources",
    label: "Resources",
    svgSource: ResourcesIcon,
    alt: "Resources",
    matches: (pathname) =>
      pathname === "/resources" || pathname?.startsWith("/resources/") === true,
  },
];
