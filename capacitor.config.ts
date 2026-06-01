import type { CapacitorConfig } from "@capacitor/cli";

const defaultAppUrl = "https://examcooker.acmvit.in";
const appUrl = process.env.EXAMCOOKER_APP_URL?.trim() || defaultAppUrl;
const appHost = new URL(appUrl).hostname;
const allowedHosts = Array.from(
  new Set([
    appHost,
    "examcooker.acmvit.in",
    "beta.examcooker.acmvit.in",
    "examcooker-2024.azurewebsites.net",
    "examcooker-beta-2024.azurewebsites.net",
  ]),
);

const config: CapacitorConfig = {
  appId: "in.acmvit.examcooker",
  appName: "ExamCooker",
  webDir: "mobile/native-shell",
  backgroundColor: "#0C1222",
  android: {
    path: "mobile/android",
    backgroundColor: "#0C1222",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    useLegacyBridge: false,
  },
  ios: {
    path: "mobile/ios",
    backgroundColor: "#0C1222",
    contentInset: "never",
    scrollEnabled: true,
    allowsLinkPreview: true,
    handleApplicationNotifications: true,
    preferredContentMode: "mobile",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0C1222",
      androidSplashResourceName: "splash",
      launchFadeOutDuration: 200,
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0C1222",
      overlaysWebView: true,
    },
  },
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    allowNavigation: allowedHosts,
  },
};

export default config;
