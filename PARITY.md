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

### Privacy mode redacts instead of blurring

The web app hides financial values with `filter: blur(6px)`. **React Native
declares that style for Android only.** Its platform implementations live under
`ReactCommon/react/renderer/components/view/platform/android`, and there is no
iOS counterpart, so on iOS the style is accepted and silently does nothing —
confirmed on a device, where values stayed fully readable.

This app therefore **redacts**: it renders the value with a transparent colour
and a filled background, so the block occupies exactly the space the value would
have. The property that mattered about the web app's blur is preserved — layout
is identical whether or not privacy mode is on, so toggling never reflows the
screen.

Two consequences:

- The block's width reveals how many digits a value has. That is inherent to
  redaction and reads the way a redacted document does; the digits themselves
  are not recoverable.
- `sort`-style visual comparison is no longer possible while privacy is on.

The **selective** rules are unchanged: in the transaction list only income is
hidden, while day headers, summary figures and the balance total hide
unconditionally. This is expressed by the `hidden` prop on `PrivacyValue`, and
must be audited call-site by call-site when screens are built.

### Charts

Feature parity, not pixel parity. The anchored balance chart keeps its defining
property — the last point equals the Balance card total by construction — and the
dotted split-adjusted overlay. Grid lines, exact tick placement and animation
timing differ.

### The filter's 500-row cap is kept, but reported

`useFilteredTransactions` caps its query at 500 rows and computes the summary from
whatever came back. This app keeps the cap — the same filter returning different
numbers on the two platforms would be worse than either number being wrong,
because nothing would say which one to trust.

What is *not* reproduced is the silence. When the cap is hit, the results screen
says so, under the summary card. Without that the balance would present a
truncated set as the whole picture.

Two related differences:

- **Year-only filters no longer double-count split sources.** Upstream builds its
  expansion input as `[...results, ...allSplitSources]`, and `results` for a
  year already contains that year's split sources — so each is expanded twice,
  producing a duplicated row and a doubled total. This app deduplicates by id
  before expanding. The two agree whenever upstream does not duplicate, and this
  one is right when it does. **This is the only place the port knowingly returns
  a different result from the web app**, and it is a correction, not a
  convention.
- **Split sources are capped at 10,000 rather than 500 per year**, matching the
  month and year views. The limit is not reachable with any realistic number of
  splits.

### The filter's amount range is two fields, not a slider

The web app's dual-thumb slider is bounded at 10,000 in steps of 100, so it cannot
express "over 12,000" or "under 5". Two numeric fields are exact, quicker than
dragging on a phone, and accept every value the slider does — a superset rather
than a divergence.

### The filter's currency list is complete, not sampled

Upstream reads 1,000 rows with no `order by` and collects the currencies it finds.
With no defined row order the sample differs between loads, so the web app does not
reliably agree with itself, let alone with this one. This app reads the whole
column instead — a superset of any sample.

### A budget's threshold uses the rounded percentage

The web app rounds spending to a whole percentage *before* comparing it against
the colour thresholds, so 90.1% of the limit is still "normal" (it rounds to 90)
and a budget only turns red once the rounded figure reaches 101 — meaning one
past its limit still reads as a warning. `isOverBudget` is the honest figure and
does not follow the percentage; it is what the card's "Over"/"Remaining" line
keys off.

Reproduced exactly, because the alternative — comparing the raw ratio — looks
just as reasonable and would disagree at the margins, which is the hardest kind
of difference to notice. Pinned down in `budget-progress.test.ts`.

The whole card opens the edit sheet rather than showing the web app's corner
pencil: a 20-point icon is not a comfortable target, and a card has nothing else
to be tapped for. Budgets also has no floating add-transaction button, matching
the web page — its own "Add budget" button is the one affordance there.

### The transaction list's search field is not editable

Tapping it pushes the search screen, where the field focuses. An editable field on
the list itself would either search in place — competing with the month strip for
what the list is showing — or look editable and then navigate, which is worse. The
back gesture replaces the web app's `from_year`/`from_month` query parameters:
search is pushed onto the period it was opened from, so popping returns there by
construction.
