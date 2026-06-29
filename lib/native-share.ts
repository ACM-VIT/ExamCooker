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
      const nativeText = [payload.text?.trim(), url].filter(Boolean).join("\n");
      await Share.share({
        title: payload.title,
        text: nativeText,
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
      // AbortError means the user dismissed the share sheet — nothing else to do.
      // NotAllowedError (e.g. permission denied / not triggered by a user gesture)
      // should fall through to the clipboard fallback below rather than surface as
      // an unhandled exception.
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(
        [payload.text?.trim(), url].filter(Boolean).join("\n"),
      );
      return true;
    } catch {
      // clipboard write can reject (permission denied, insecure context, etc.)
      return false;
    }
  }

  return false;
}
