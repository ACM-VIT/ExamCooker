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
  android: {
    path: "mobile/android",
  },
  ios: {
    path: "mobile/ios",
  },
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    allowNavigation: allowedHosts,
  },
};

export default config;
