# Deep-link verification files

These two files make iOS **Universal Links** and Android **App Links** open
shared `https://(www.)torahweb.org/content/<kind>/<id>` links in the TorahWeb
app instead of the browser. They must be hosted on the live site, served over
HTTPS with **no redirects**.

## Where to deploy

Copy both files to the document root of **both** hostnames the app declares
(`torahweb.org` and `www.torahweb.org`):

| File | URL it must be reachable at |
|------|-----------------------------|
| `apple-app-site-association` | `https://www.torahweb.org/.well-known/apple-app-site-association` |
| `assetlinks.json`            | `https://www.torahweb.org/.well-known/assetlinks.json` |

Serving requirements:
- **`apple-app-site-association`** — no file extension, `Content-Type: application/json`,
  reachable directly (no 301/302). Apple's CDN fetches it; allow a few days for
  propagation, or use the developer.apple.com "Universal Links" diagnostic.
- **`assetlinks.json`** — `Content-Type: application/json`. Verify with Google's
  Statement List Tester:
  `https://developers.google.com/digital-asset-links/tools/generator`

## Placeholders to fill in

### 1. `apple-app-site-association` → `REPLACE_WITH_TEAMID`
Your 10-character Apple Developer **Team ID**. Find it at
developer.apple.com → Membership, or in Xcode → Signing & Capabilities.
Result looks like: `"appIDs": ["AB12CD34EF.org.torahweb.app"]`

### 2. `assetlinks.json` → `REPLACE_WITH_RELEASE_SHA256_FINGERPRINT`
The SHA-256 fingerprint of the certificate that signs the **release** build.

- If you use **Google Play App Signing** (recommended): copy the SHA-256 from
  Play Console → your app → **Setup → App integrity → App signing key
  certificate**. This is the one end users actually get, so it's the one that
  matters.
- For a **local keystore**:
  ```
  keytool -list -v -keystore <release.keystore> -alias <your-alias>
  ```
  Copy the `SHA256:` line (colon-separated hex).

You can list **multiple** fingerprints in the array (e.g. your upload key *and*
the Play signing key, or a debug key for testing) — add them as extra strings.

## App-side config (already in the repo)

- iOS entitlement: `TorahWeb/ios/TorahWeb/TorahWeb.entitlements`
  (`applinks:torahweb.org`, `applinks:www.torahweb.org`)
- Android intent filter: `TorahWeb/android/app/src/main/AndroidManifest.xml`
  (`autoVerify="true"` for the torahweb.org host)
- In-app routing: `TorahWeb/src/navigation/AppNavigator.tsx` (`linking` config)
