export async function openExternalUrl(url: string): Promise<void> {
  const target = url.trim();
  if (!target) return;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({
        url: target,
        presentationStyle: "fullscreen",
        toolbarColor: "#0C1222",
      });
      return;
    }
  } catch {
    // fallback below
  }

  window.open(target, "_blank", "noopener,noreferrer");
}
