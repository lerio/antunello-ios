# Parity with the web app

This app is a native port of the Antunello web app (`../antunello-app`). The two
share one Supabase database and one set of bank integrations, so a behavioural
difference between them is a bug, not a variation.

This file records what is shared, how drift is detected, and what has been
deliberately allowed to differ.

---

## The parity rule

**The server side is shared by construction.** Both clients read and write the
same Supabase tables and call the same Vercel API routes. A schema change, a new
RPC, or a new API route is written once and both apps get it. There is nothing to
keep in sync there.

**Application logic is not shared.** The web app is React + Tailwind + Recharts
in a browser; this app is React Native with native controls. Screens are written
twice, and there is no mechanism that avoids that.

**Domain logic is vendored.** The pure, I/O-free half of the business logic is
copied verbatim into `src/domain/`, with the copy tracked by hash.

---

## Vendored files

Every file in `src/domain/` carries a header naming its web source and the
sha256 of that source after import rewriting:

```ts
/**
 * @vendored-from antunello-app:utils/split-transactions.ts
 * @upstream-sha256 7c9621f7aa54…
 * @vendored-on 2026-09-10
 * @parity exact
 * @divergences none
 */
```

| Local | Upstream | Parity |
|---|---|---|
| `src/domain/types.ts` | `types/database.ts` | exact |
| `src/domain/app-constants.ts` | `constants/app-constants.ts` | exact |
| `src/domain/number.ts` | `utils/number.ts` | exact |
| `src/domain/date.ts` | `utils/date.ts` | exact |
| `src/domain/currency-amount-input.ts` | `utils/currency-amount-input.ts` | exact |
| `src/domain/form-validation.ts` | `utils/form-validation.ts` | exact |
| `src/domain/money-transfer-validation.ts` | `utils/money-transfer-validation.ts` | exact |
| `src/domain/transaction-utils.ts` | `utils/transaction-utils.ts` | exact |
| `src/domain/tr-bonuses.ts` | `utils/tr-bonuses.ts` | exact |
| `src/domain/split-transactions.ts` | `utils/split-transactions.ts` | exact |

`exact` means byte-identical to upstream apart from `@/` import specifiers, which
are rewritten to relative paths. The only edits applied to these files are those
alias rewrites.

### Parity vocabulary

- **exact** — byte-identical upstream except the import block. `@divergences`
  must read `none`.
- **adapted** — same logic, changed imports or I/O. `@divergences` must list what
  changed, and a test must prove the behaviour still matches.
- **rewritten** — reimplemented against the same observable behaviour. Used where
  the web version is entangled with browser-only machinery. `@divergences` is
  required, and the file says which tests pin it.

---

## Checking drift

```bash
npm run parity          # report drift; exits non-zero if any
npm run vendor          # re-copy from the web repo
npm run vendor:check    # show what re-vendoring would change
```

Three hashes are compared per file:

- **expected** — hash of the upstream file *as it is right now*, alias-rewritten
- **recorded** — the `@upstream-sha256` in the local file's header
- **actual** — hash of the local file with its header stripped

| State | Meaning | Action |
|---|---|---|
| `ok` | all three agree | nothing |
| `UPSTREAM-DRIFT` | the web app changed | review the diff, then `npm run vendor` |
| `LOCAL-DRIFT` | the copy was hand-edited | revert it, or change upstream first |
| `UPSTREAM-GONE` | the source file was deleted or moved | update `scripts/domain-map.mjs` |
| `NO-HEADER` | the file has no provenance header | re-vendor it |

Point the check at a different checkout with `WEB_REPO=/path/to/repo npm run parity`.

### Adding a file to the shared set

Add an entry to `src/domain/../scripts/domain-map.mjs` and run `npm run vendor`.
If the file imports an alias not yet mapped, vendoring fails loudly rather than
emitting a broken path.

---

## Tests

```bash
npm test
```

Tests run under Node via `tsx`, not in the app. They pin the vendored logic —
most importantly that the twelve slices of a split transaction sum *exactly* to
the source amount, for both 2-decimal currencies and JPY.

Tests are the real parity guarantee. The hash tells you *that* something changed;
a test tells you *what* changed behaviourally. When `parity` reports
`UPSTREAM-DRIFT`, re-vendor and then run the tests — a failure there is the signal
that a behavioural change needs review rather than a mechanical copy.

---

## The one trap worth knowing

`split-transactions.ts` gives `amount` two different meanings:

- **In the source month**, the row is still the real database row, so `amount`
  stays the *full original* and only `split_display_amount` holds that month's
  slice.
- **In later months**, there is no real row, so `amount` itself becomes the slice.

Reading `.amount` directly therefore double-counts the source month. Always use
`getTransactionDisplayAmount()` (and `getTransactionDisplayEurAmount()` for the
EUR figure). This is pinned by a test named "never requires callers to read
`amount` directly".

---

## Deliberate differences

These are intentional and are not drift.

### Screens not ported

The web app's `/protected/admin` page is absent: no CSV import, no fund-category
CRUD, no data management, no exchange-rate retry, no delete-all. These are
desktop-shaped, rarely-used, and one-off setup tasks.

### Screens merged

The web app has both a transaction modal and standalone `/protected/add` and
`/protected/edit/[id]` pages. This app ships the capability as a single sheet.
Capability parity is preserved; screen count is not.

### Bank connection

Connecting or re-authenticating a bank opens the deployed web app's settings page
in an in-app browser (`expo-web-browser`), rather than reimplementing the Enable
Banking OAuth redirect and the Trade Republic phone/PIN/2FA flow natively. Those
flows need a PEM private key and a Python service, neither of which can ship in a
phone app.

**Consequence:** `SFSafariViewController` has its own cookie jar, so the browser
starts logged out. Signing in to the web app inside that sheet is required before
the settings page appears. Keychain autofill makes it quick, and it only happens
when connecting or re-authenticating a bank.

### Refresh model

The web app polls a `(count, last-updated_at)` fingerprint every 15 seconds and
shows a persistent update banner. This app refreshes on foreground and on
pull-to-refresh, and surfaces remote changes as a transient toast. Supabase
Realtime is deliberately unused — the web app removed it for performance, and on
iOS a backgrounded socket drops silently.

### Charts

Feature parity, not pixel parity. The anchored balance chart keeps its defining
property — the last point equals the Balance card total by construction — and the
dotted split-adjusted overlay. Grid lines, exact tick placement and animation
timing differ.
