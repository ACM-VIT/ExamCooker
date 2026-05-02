import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeChromeLogoOptions = {
  visible: boolean;
  darkMode?: boolean;
};

type NativeChromePlugin = {
  setLogoVisible(options: NativeChromeLogoOptions): Promise<void>;
};

const NativeChrome = registerPlugin<NativeChromePlugin>("NativeChrome", {
  web: {
    async setLogoVisible() {},
  },
});

export function canUseNativeChrome() {
  return (
    typeof window !== "undefined" &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios"
  );
}

export function setNativeChromeLogoVisible(options: NativeChromeLogoOptions) {
  return NativeChrome.setLogoVisible(options);
}
