# Native App

ExamCooker uses a PWA + Capacitor hybrid setup.

The iOS and Android binaries load the hosted web app by default, so normal
website deploys can update app screens and content without submitting a new
binary. Ship a store update only when native app identity, permissions,
Capacitor plugins, splash/icon assets, or native platform code changes.

## Configuration

The Capacitor config lives in `capacitor.config.ts`.

- Default app URL: `https://examcooker.acmvit.in`
- Override for local or beta testing: `EXAMCOOKER_APP_URL`
- Native app id: `in.acmvit.examcooker`

Examples:

```bash
EXAMCOOKER_APP_URL=https://beta.examcooker.acmvit.in pnpm cap:sync
EXAMCOOKER_APP_URL=http://localhost:3000 pnpm cap:sync
```

## Commands

```bash
pnpm cap:sync
pnpm cap:open:ios
pnpm cap:open:android
```

Use `pnpm cap:sync` after changing `capacitor.config.ts`, native icons, native
plugins, or the local fallback shell.

## App Review Notes

The app should keep native value beyond a plain WebView wrapper. Good native
additions for ExamCooker include push reminders, deep links into courses and
papers, native sharing, saved/recent study state, and offline-friendly recent
content.
