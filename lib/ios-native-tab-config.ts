import type { TabConfig } from "capacitor-native-tabs";
import { APP_NAV_LINKS } from "@/lib/app-nav-links";

const TAB_SYSTEM_IMAGES = [
  "house.fill",
  "doc.text.fill",
  "note.text",
  "list.clipboard.fill",
  "books.vertical.fill",
] as const;

export function buildIosNativeTabConfigs(): TabConfig[] {
  return APP_NAV_LINKS.map((link, index) => ({
    title: link.label,
    systemImage: TAB_SYSTEM_IMAGES[index] ?? "circle.fill",
    route: link.href,
  }));
}
