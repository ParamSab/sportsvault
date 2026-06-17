# SportsVault — App Store Submission Guide

This app ships as a **Capacitor iOS wrapper** that loads the live site
`https://sportsvault.vercel.app` in a native WebView, plus native push
notifications, splash, and status-bar integration. We load the remote URL (not a
bundled static export) on purpose: the app relies on cookie-based sessions
(iron-session) and server API routes, which only work same-origin inside the
WebView.

Bundle ID: `com.paramsab.sportsvault` · Display name: **SportsVault** · v1.0 (build 1)

---

## What's already done (in this repo)
- ✅ `Info.plist`: display name, privacy strings (location, camera, photos), push
  background mode, portrait-only, `arm64`, `ITSAppUsesNonExemptEncryption=false`.
- ✅ App icon flattened to 1024×1024 **with no alpha channel** (App Store requirement).
- ✅ Production config synced — WebView points to `https://sportsvault.vercel.app`
  over HTTPS (`cleartext: false`).
- ✅ Build scripts: `npm run mobile:sync:prod`, `npm run mobile:open`.
- ✅ Simulator build validated (compiles + launches).

## What still needs YOU (requires an Apple Developer account)

### 0. Prerequisites
- **Apple Developer Program** membership ($99/yr) — https://developer.apple.com/programs/
- Your **Team ID** (App Store Connect → Membership), e.g. `A1B2C3D4E5`.
- A **privacy policy URL** (required for any app that collects data — yours does:
  phone, location, photos). Host one (e.g. `https://sportsvault.vercel.app/privacy`).

### 1. Register the bundle ID
developer.apple.com → Certificates, IDs & Profiles → Identifiers → +
→ App IDs → `com.paramsab.sportsvault`. Enable **Push Notifications** capability.

### 2. Set signing in Xcode
```
npm run mobile:sync:prod   # ensure prod URL is baked in
npm run mobile:open        # opens ios/App in Xcode
```
In Xcode → target **App** → Signing & Capabilities:
- Check **Automatically manage signing**, select your **Team**.
- Confirm bundle id `com.paramsab.sportsvault`.
- Add the **Push Notifications** capability (matches Info.plist background mode).
  > Note: push requires an APNs key + server wiring before it actually delivers.
  > It's fine to ship without sending pushes yet; or remove the capability +
  > the `remote-notification` UIBackgroundMode + `@capacitor/push-notifications`
  > if you don't want it reviewed.

### 3. Create the app in App Store Connect
appstoreconnect.apple.com → Apps → + → New App
- Platform iOS, name **SportsVault** (must be globally unique), language, bundle id,
  SKU (any string, e.g. `sportsvault-001`).

### 4. Archive & upload
Xcode → device target **Any iOS Device (arm64)** → Product → **Archive** →
Organizer → **Distribute App** → App Store Connect → Upload.
(CLI alternative: `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -archivePath build/App.xcarchive archive` then `-exportArchive`.)

### 5. Store listing (App Store Connect)
- **Screenshots** (required): 6.9"/6.7" iPhone (1290×2796 or 1320×2868) — at least
  2–3. Capture from the iPhone simulator (`Cmd+S` saves to Desktop). iPad shots only
  if you keep iPad support.
- Description, keywords, support URL, marketing URL (optional).
- **Privacy policy URL** (required).
- **Age rating** questionnaire.
- **App Privacy "nutrition" labels**: declare data collected — Phone number
  (account), Coarse/Precise Location (app functionality), Photos (account), and
  any analytics. Be accurate; mismatches cause rejection.

### 6. Submit for review
Attach the build, fill "Notes for Reviewer" with **a test login** (a phone number
+ the bypass OTP `990770`, or a seeded test account) so the reviewer can get past
the auth gate. Submit.

---

## ⚠️ Guideline 4.2 (Minimum Functionality) — the main review risk
Apple sometimes rejects apps that are "just a website in a wrapper." Mitigations,
in order of impact:
1. **Keep & demonstrate native features** — push notifications, location-based
   discovery, camera/photo upload. Mention these in the reviewer notes.
2. **Give the reviewer working access** (test creds above) so they see a real,
   app-like product, not a login wall.
3. If rejected under 4.2, the durable fix is to bundle the frontend as a static
   export and call the API cross-origin — but that requires migrating session auth
   off cookies (to a token/Authorization header). Larger change; do only if needed.

## Pre-submit checklist
- [ ] Apple Developer membership active
- [ ] Bundle id registered with Push capability
- [ ] Team selected, automatic signing green in Xcode
- [ ] `mobile:sync:prod` run (config → vercel URL, HTTPS)
- [ ] Privacy policy URL live
- [ ] Screenshots captured
- [ ] App Privacy labels filled accurately
- [ ] Reviewer test login provided
- [ ] Archive uploaded & processed in App Store Connect
