# EAS Build / Submit

How to build and ship this app with [EAS](https://docs.expo.dev/build/introduction/)
(expo.dev's cloud build service). This is a **bare React Native** project — there
is no Expo SDK installed. EAS builds the committed `ios/` and `android/` native
projects directly; it does **not** run `expo prebuild`.

## Important: run everything from this folder

The app (its `package.json`, `eas.json`, `app.json`, `ios/`, `android/`) lives in
`TorahWeb/`, not the repo root. Always `cd` in first:

```powershell
cd C:\Users\tani\IdeaProjects\TorahWebApp\TorahWeb
```

Running `eas` from the repo root picks up stray root-level files and fails.

## One-time account setup

```powershell
npm i -g eas-cli      # install the CLI
eas login             # log in to the Expo account (owner: torahweb-app)
```

The project is already created and linked: `@torahweb-app/torahwebapp`
(projectId `334f8e76-bb50-409b-ac44-5f5ecbaca432`, stored in `app.json` under
`expo.extra.eas.projectId`). No need to run `eas init` again.

### About app.json
`app.json` carries both bare-RN keys (`name`, `displayName` — read by React
Native CLI and `index.js`) and an `expo` block (read by EAS). This produces a
**harmless** warning on every build:

> Warning: Root-level "expo" object found. Ignoring extra keys ... "name", "displayName"

That is expected. The root keys exist for RN; Expo correctly ignores them and
uses `expo.name` / `expo.slug`. The `expo.slug` **must** stay `torahwebapp` to
match the linked EAS project.

## Build profiles (`eas.json`)

| Profile       | iOS                          | Android        | Use for |
|---------------|------------------------------|----------------|---------|
| `development` | Debug, **simulator** build   | Debug `.apk`   | Local dev vs Metro; needs **no** Apple credentials |
| `preview`     | Release, internal (ad-hoc)   | Release `.apk` | QA / sharing on registered devices |
| `production`  | Release, store-signed        | `.aab`         | App Store / Play Store |

## npm scripts

```
npm run build:dev:ios          # development profile, iOS simulator
npm run build:dev:android      # development profile, Android apk
npm run build:preview:ios      # preview profile, iOS (real device, ad-hoc)
npm run build:preview:android  # preview profile, Android apk
npm run build:prod:ios         # production profile, iOS (store)
npm run build:prod:android     # production profile, Android aab (store)
npm run build:prod:all         # production, both platforms
npm run submit:ios             # submit a finished build to App Store Connect
npm run submit:android         # submit a finished build to Play Store
```

## iOS credentials

You never store an Apple ID in the repo. EAS manages the signing cert +
provisioning profile on Expo's servers; you authenticate interactively.

- **Prerequisite:** Apple ID enrolled in the **Apple Developer Program** ($99/yr)
  with **2FA** enabled.
- **Easy path:** run a device build (`npm run build:preview:ios`) and log in when
  prompted. EAS registers the bundle ID `org.torahweb.app`, creates the
  Distribution Certificate + Provisioning Profile, and reuses them next time.
- **Manage anytime:** `eas credentials` (interactive menu).
- **Register test devices** for `preview` (ad-hoc only installs on known devices):
  ```powershell
  eas device:create   # open the link/QR on the device, then rebuild
  ```
- **Submitting:** `eas submit` needs an **App Store Connect API key** (EAS can
  generate one during submit, or create it in App Store Connect → Users and
  Access → Integrations/Keys).

The `development` (simulator) build needs **none** of the above.

## Android credentials

EAS auto-generates and stores a keystore on first build — nothing to do. For Play
Store submission you'll later connect a Google Play service-account key.

## ⚠️ Xcode version (Liquid Glass)

The iOS 26 **Liquid Glass** tab bar only renders when built with **Xcode 26**.
All iOS profiles pin `"image": "latest"` in `eas.json` to get the newest Xcode.
On the first build, confirm the log shows Xcode 26 — if `latest` resolves to an
older Xcode, pin the explicit `…-xcode-26.x` image in `eas.json`.

## Notes

- The `react-native-track-player` patch in `patches/` applies automatically: EAS
  runs `npm install`, which triggers the `postinstall` → `patch-package` step.
- Recommended first run is `npm run build:dev:ios` — the simulator build skips
  Apple credentials, so it's the fastest way to validate the EAS pipeline.
</content>
