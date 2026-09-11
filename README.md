# Antunello for iOS

A native iPhone app for [Antunello](https://antunello-app.vercel.app), a personal
finance tracker. This is a second client against the same Supabase database and
the same deployed API routes as the web app — not a fork of it.

Private, single-user, and never distributed. There is no App Store build, no
Android target, and no iPad layout.

## Requirements

- macOS with **Xcode 26**
- **CocoaPods** (`brew install cocoapods`)
- Node 20+

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run ios:device           # build, install and launch on a connected iPhone
npm start                    # Metro only — JS changes reload without a rebuild
```

See **`CLAUDE.md`** for the full setup, including the signing steps that free
Apple provisioning requires and the errors that mislead you when it goes wrong.

## Checks

```bash
npm run typecheck    # app config and test config
npm test             # vendored domain logic
npm run parity       # drift against ../antunello-app
```

All three must pass before a change is considered done.

## Layout

```
src/app/         expo-router routes (thin)
src/domain/      pure logic vendored from the web app — see PARITY.md
src/features/    one folder per feature
src/lib/         infrastructure
```

Two rules keep the structure honest: `src/domain/**` may import only from itself
(no React, no I/O), and route files stay thin.

## Documentation

| File | Covers |
|---|---|
| `CLAUDE.md` | Setup, signing, architecture, conventions |
| `PARITY.md` | What is shared with the web app, and how drift is detected |
