# Native App

ExamCooker uses a PWA + Capacitor hybrid setup.

The iOS and Android binaries load the hosted web app by default, so normal
website deploys can update app screens and content without submitting a new
binary. Ship a store update only when native app identity, permissions,
Capacitor plugins, splash/icon assets, or native platform code changes.

## Configuration

Native shells and Xcode / Gradle projects live under `mobile/`. The Capacitor
config stays at the repo root (`capacitor.config.ts`) so the CLI runs next to
`package.json`; it references `mobile/` for `webDir`, iOS, and Android paths.

- Default app URL: `https://examcooker.acmvit.in`
- Override for local or beta testing: `EXAMCOOKER_APP_URL`
- Native app id: `in.acmvit.examcooker`
- HTTPS app-link domains: `examcooker.acmvit.in`, `beta.examcooker.acmvit.in`
- Custom scheme fallback: `examcooker://`

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
plugins, or the local fallback shell under `mobile/native-shell`.

## Deep Links

The native apps are configured for iOS Universal Links and Android App Links,
so supported `https://examcooker.acmvit.in/...` and
`https://beta.examcooker.acmvit.in/...` URLs open directly in the installed app.
The same in-app router also accepts `examcooker://...` fallback links.

The production web app must serve these association endpoints:

- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

Configure the deployed web environment with:

```bash
ANDROID_APP_LINK_SHA256_FINGERPRINTS=<sha256-fingerprint>[,<another-fingerprint>]
```

`APPLE_TEAM_ID` can override the bundled Apple team ID if signing moves to a
different developer team. `ANDROID_APP_LINK_SHA256` is also supported for a
single fingerprint. Include every signing certificate that should verify links,
especially the Play App Signing certificate and any non-Play release certificate
used for distribution.

## App Review Notes

The app should keep native value beyond a plain WebView wrapper. Good native
additions for ExamCooker include push reminders, deep links into courses and
papers, native sharing, saved/recent study state, and offline-friendly recent
content.

For App Store review builds, configure the hosted app with an env-backed demo
login so reviewers can access the app without Google or Apple account handoff:

```bash
APP_REVIEW_EMAIL=reviewer@example.com
APP_REVIEW_PASSWORD=replace-with-a-strong-temporary-password
APP_REVIEW_NAME="App Review"
APP_REVIEW_ROLE=MODERATOR
```

When these variables are present, `/auth` shows an App Review sign-in form in
addition to Google and Apple OAuth. Remove or rotate the password after review.
Use `APP_REVIEW_ROLE=MODERATOR` only when the reviewer needs access to
moderation-only surfaces.
