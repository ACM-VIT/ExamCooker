import type { TabConfig } from "capacitor-native-tabs";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

type ExamCookerTabConfig = TabConfig & {
  androidIcon?: string;
  theme?: "dark" | "light";
};

const TAB_SYSTEM_IMAGES = [
  "house.fill",
  "doc.text.fill",
  "note.text",
  "list.clipboard.fill",
  "books.vertical.fill",
] as const;

const TAB_ANDROID_ICONS = [
  "ec_tab_home",
  "ec_tab_papers",
  "ec_tab_notes",
  "ec_tab_syllabus",
  "ec_tab_resources",
] as const;

export function buildIosNativeTabConfigs(theme?: "dark" | "light"): ExamCookerTabConfig[] {
  return APP_NAV_LINKS.map((link, index) => ({
    androidIcon: TAB_ANDROID_ICONS[index],
    theme,
    title: link.label,
    systemImage: TAB_SYSTEM_IMAGES[index] ?? "circle.fill",
    route: link.href,
  }));
}
