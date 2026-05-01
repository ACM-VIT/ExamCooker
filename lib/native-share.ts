export type SharePayload = {
  title?: string;
  text?: string;
  url: string;
};

export async function shareUrl(payload: SharePayload): Promise<boolean> {
  const url = payload.url.trim();
  if (!url) return false;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: payload.title,
        text: payload.text,
        url,
        dialogTitle: payload.title ?? "Share",
      });
      return true;
    }
  } catch {
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url,
      });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  return false;
}
