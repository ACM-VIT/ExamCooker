"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeDownloadOptions = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

type NativeDownloadsPlugin = {
  shareFile(options: NativeDownloadOptions): Promise<void>;
};

const NativeDownloads = registerPlugin<NativeDownloadsPlugin>("NativeDownloads", {
  ios: {
    shareFile(options: NativeDownloadOptions) {
      const nativePromise = (
        Capacitor as typeof Capacitor & {
          nativePromise?: <T>(
            pluginName: string,
            methodName: string,
            options?: unknown,
          ) => Promise<T>;
        }
      ).nativePromise;

      if (!nativePromise) {
        return Promise.reject(new Error("Native downloads bridge is unavailable"));
      }

      return nativePromise<void>("NativeDownloads", "shareFile", options);
    },
  },
});

export function canUseNativeFileDownload() {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios"
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

export async function shareBlobWithNativeDownloads(blob: Blob, fileName: string) {
  const base64Data = arrayBufferToBase64(await blob.arrayBuffer());
  await NativeDownloads.shareFile({
    fileName,
    mimeType: blob.type || "application/octet-stream",
    base64Data,
  });
}
