// The iOS and Android apps load the site in a web view. There the native
// camera gives a steadier, full-screen capture than the browser's file input.
// App builds made before the camera plugin was added do not have it, so every
// caller must keep the web capture as a fallback.

const NATIVE_PHOTO_MAX_EDGE = 2400;
const NATIVE_PHOTO_QUALITY = 85;

export async function isNativeCameraAvailable() {
  if (typeof window === "undefined") return false;
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Camera");
}

function isCancellation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cancel/i.test(message);
}

function base64ToJpegFile(base64: string, name: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes], name, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Takes one photo with the native camera. Resolves to null when the user
 * cancels. The photo is returned as base64 rather than a file URI: the app's
 * pages come from the website's origin, which cannot read the web view's
 * local file URLs.
 */
export async function takeNativePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Base64,
      quality: NATIVE_PHOTO_QUALITY,
      width: NATIVE_PHOTO_MAX_EDGE,
      height: NATIVE_PHOTO_MAX_EDGE,
      correctOrientation: true,
      saveToGallery: false,
    });
    if (!photo.base64String) return null;
    return base64ToJpegFile(photo.base64String, `page-${Date.now()}.jpg`);
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
}
