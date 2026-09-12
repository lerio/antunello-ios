@AGENTS.md

# Antunello for iOS

A native iOS client for the Antunello personal finance app. It is **not** a
rewrite of the web app — it is a second client against the same Supabase
database and the same deployed API routes.

Companion repo: `../antunello-app` (Next.js 16 + Supabase, deployed on Vercel at
`https://antunello-app.vercel.app`).

---

## Behavioral guidelines

### 1. Think before coding

Don't assume. Surface tradeoffs. If a simpler approach exists, say so. State
assumptions explicitly, and if something is unclear, stop and ask rather than
guessing.

### 2. Simplicity first

Minimum code that solves the problem. No speculative features, no abstractions
for single-use code, no configurability nobody asked for. If 200 lines could be
50, rewrite it.

### 3. Surgical changes

Touch only what you must. Match the surrounding style. Don't refactor things that
aren't broken, and don't improve adjacent code in passing. If you spot unrelated
dead code, mention it rather than deleting it.

### 4. Goal-driven execution

Define success criteria, then loop until verified. For multi-step work, state a
short numbered plan with its verification checks. `npm run typecheck && npm test
&& npm run parity` must pass before anything is called done.

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Expo SDK 57 (React Native 0.86.3, React 19.2), New Architecture |
| Routing | `expo-router` 57 with native tabs (`expo-router/unstable-native-tabs`) |
| Language | TypeScript 6, strict |
| Target | iOS only — no Android, no web, no iPad |
| Data | Supabase (direct, RLS-scoped) |
| Server | The deployed web app's API routes, for bank sync only |

Android config lingers in `app.json` from the Expo template. It is unused — this
app targets iPhone only.

---

## Build and run

### Everyday development

```bash
npm start                       # Metro only — JS changes reload instantly
```

**The app on the phone does not carry any JavaScript.** It is a debug build, so
it fetches its bundle from Metro over the LAN at launch — the address is baked
into the app as `ip.txt` (currently `<lan-address>:8081`) when it is installed.
Metro therefore has to be running *before* the app is opened, and since Metro is
a foreground process in a terminal, **closing or restarting that terminal breaks
the app** until it is started again:

> No script URL provided. Make sure the packager is running or you have embedded
> a JS bundle in your application bundle.

That message means exactly what it says and never indicates a code problem. Start
`npm start`, then swipe the app away and reopen it — a relaunch alone may not be
enough, since the failed launch is cached.

If the Mac's LAN address changes (a different network, a new router), `ip.txt` is
stale and no amount of restarting Metro will help: the phone is looking for a
host that is gone. Check the two against each other —

```bash
ipconfig getifaddr en0
cat ~/Library/Developer/Xcode/DerivedData/Antunello-*/Build/Products/Debug-iphoneos/Antunello.app/ip.txt
```

— and if they differ, rebuild with `npm run ios:device`, which rewrites the file.
That also restarts the seven-day provisioning clock, so it is worth doing anyway
when the app is close to expiring.

Native changes, config changes, and dependency changes need a rebuild.

### First-time or after native changes

```bash
npm run ios:device              # expo run:ios --device
```

### Two builds, and the difference is not cosmetic

`AppDelegate.swift` decides where the JavaScript comes from, on a compile-time
switch:

```swift
#if DEBUG
  …jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")   // fetch from Metro
#else
  Bundle.main.url(forResource: "main", withExtension: "jsbundle")   // embedded
#endif
```

**Debug** needs Metro reachable at the address in `ip.txt`, so the phone must be
on the same Wi-Fi as the Mac and the Mac must be awake. It is the development
build: JS changes reload instantly, the dev menu works, warnings appear as a
banner.

**Release** embeds the bundle. It needs nothing — no Metro, no cable, no network
— and is what the app should be for daily use. The cost is that **any JS change
needs a full rebuild**, so it is not the build to develop against.

Both expire after **seven days** on free provisioning. Reinstalling resets the
clock, and the session and cached data survive it as long as the app is not
deleted. They share a bundle id, so installing one replaces the other.

```bash
cd ios && xcodebuild \
  -workspace Antunello.xcworkspace -scheme Antunello \
  -configuration Release \
  -destination 'id=<xctrace-UDID>' \
  -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic -jobs 4 \
  build

xcrun devicectl device install app --device <devicectl-UUID> \
  ~/Library/Developer/Xcode/DerivedData/Antunello-*/Build/Products/Release-iphoneos/Antunello.app
```

Note the two different device identifiers, and see trap 4 below for why.

### The app icon and splash

```bash
npm run icon                    # redraw assets/images/*.png and the .icon bundle
```

Draws the icon with no dependencies — see `scripts/make-icon.mjs` for why. The
geometry lives in that file, so change it there and re-run rather than editing
the PNGs. **An icon change needs a rebuild** (`npm run ios:device`) before it
shows on the phone; nothing at runtime reads it.

### Running the tests and checks

```bash
npm run typecheck               # app config + test config
npm test                        # vendored domain tests, under Node via tsx
npm run parity                  # drift check against ../antunello-app
```

### Signing: why a plain `expo run:ios` may fail

This app uses **free Apple provisioning**, which has constraints that produce
errors whose messages don't explain the real cause. Everything below was learned
the hard way.

**1. The team ID is the certificate's `OU` field, not its common name.** A
development certificate looks like:

```
subject=UID=<cert-id>, CN=Apple Development: you@example.com (<cert-cn-id>), OU=<team-id>
                  └ cert id            └ personal team id                    └ TEAM ID
```

`<team-id>` is the team ID. Using the value in the common name produces
`No Account for Team "…"`, which sounds like a credentials problem but is not.

**2. The WWDR G3 intermediate must be in the keychain.** Without it, a perfectly
valid certificate reports as *0 valid identities* because macOS cannot build the
trust chain. Check with `security find-identity -v -p codesigning`; if it reports
zero, install the intermediate:

```bash
curl -sSfL -o /tmp/AppleWWDRCAG3.cer https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
security import /tmp/AppleWWDRCAG3.cer -k ~/Library/Keychains/login.keychain-db
```

**3. `expo run:ios` does not pass `-allowProvisioningUpdates`**, and Expo's
prebuild never writes `CODE_SIGN_STYLE`. A headless build therefore fails with
*"Automatic signing is disabled and unable to generate a profile"*. Build with
xcodebuild directly instead:

```bash
cd ios && xcodebuild \
  -workspace Antunello.xcworkspace \
  -scheme Antunello \
  -configuration Debug \
  -destination 'id=<DEVICE-UDID>' \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  build
```

**4. Device identifiers differ between tools.** `expo run:ios` matches against
the **xctrace** UDID, not the `devicectl` UUID:

```bash
xcrun xctrace list devices        # what expo wants: <device-udid>
xcrun devicectl list devices      # a different id: <devicectl-uuid>-…
```

Passing the devicectl UUID yields `No device UDID or name matching`.

**5. Limit build parallelism on a memory-constrained machine.** `xcodebuild`
spawns one compiler per core, and on a 24 GB machine the peak is enough to push
macOS into heavy swap and start killing other processes — Metro in particular,
which then has to be restarted.

```bash
xcodebuild … -jobs 4 build        # cap concurrent compiler jobs
```

Worth doing whenever Metro is expected to stay up during a build. Xcode left
open in the background adds to the pressure and is worth quitting between
sessions.

**5. The `xcode` npm package's `writeSync()` does not persist in this setup.**
Both a config plugin and a standalone patch script reported success while
changing nothing. Do not rely on programmatic edits to `project.pbxproj` — verify
the file actually changed, and prefer command-line build-setting overrides.

### The 7-day cycle

Free provisioning means the **provisioning profile** expires weekly and the app
stops launching until it is rebuilt and reinstalled. The signing *certificate* is
valid for a year — it is the profile that lapses.

Local data and the signed-in session survive re-signing, provided the bundle
identifier (`com.lerio.antunello`) never changes and the app is installed over
itself rather than deleted first.

---

## Architecture

```
src/
  app/          expo-router routes. Thin — read params, render a feature screen.
  domain/       Vendored pure logic from the web app. See PARITY.md.
  features/     One folder per feature: queries, mutations, screens.
  components/   Shared native UI primitives.
  constants/    Design tokens (colors, spacing, fonts).
  hooks/        Cross-cutting hooks.
  lib/          Infrastructure: supabase client, query client, formatters.
```

### The two rules that hold this together

**`src/domain/**` may import only from `src/domain/**`.** No React, no React
Native, no I/O. This is what allows the folder to be a mechanical copy of the web
repo and lets `npm run parity` treat it as such. Adding an import that breaks
this rule breaks the parity guarantee.

**`src/app/**` files stay thin.** Read route params, render one screen from
`src/features/`. Business logic belongs in features or domain, never in a route
file.

### Conventions

- **Money colors are semantic, never literal.** Read `theme.income` /
  `theme.expense` / `theme.transfer` rather than a hex value.
- **Split transactions: never read `.amount` directly.** In the source month it
  holds the full original while `split_display_amount` holds that month's slice;
  in later months `amount` *is* the slice. Use `getTransactionDisplayAmount()`.
  See PARITY.md.
- **`Intl` is not fully trustworthy under Hermes.** `src/lib/runtime-check.ts`
  verifies currency precision at startup and fails loudly, because a wrong answer
  would silently corrupt split rounding.
- **No Supabase Realtime.** Refresh on foreground and on pull-to-refresh.
- **Privacy mode redacts; it never blurs.** `filter` is declared for Android only
  in React Native and silently does nothing on iOS. Hide values with
  `<PrivacyValue>`, and set its `hidden` prop to reproduce the web app's
  selective rules. See PARITY.md.

---

## What is deliberately absent

The web app's `/protected/admin` page — CSV import, fund-category CRUD, data
management, exchange-rate retry, delete-all — is not ported. These are
desktop-shaped, rarely used, and one-off setup.

Bank connection is handled by opening the deployed web app's settings page in an
in-app browser, rather than reimplementing OAuth and phone/2FA flows that depend
on a server-side private key.
