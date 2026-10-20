/**
 * Every user-facing surface of the web app, and where it stands on iOS.
 *
 * `domain-map.mjs` guards the *shared logic*; this guards the *features*. The
 * screens are written twice, so nothing stops the web app gaining a page or a
 * component that this app never hears about. `npm run parity` therefore fails
 * when a web surface is not listed here, which forces a decision at the moment
 * the feature lands: port it, or record why not.
 *
 * Surfaces checked for completeness (see `feature-check.mjs`):
 *   app/**\/page.tsx, app/api/**\/route.ts,
 *   components/features/*.tsx, components/layout/*.tsx
 *
 * `components/ui/` is primitives, not features, and is not scanned — but an
 * entry may name any web file, which is how a known gap in `ui/` is recorded.
 *
 * Statuses:
 *   ported      built on iOS; `ios` lists the files that carry it, and each must
 *               exist. Several files is normal — a web page is often a route plus
 *               a feature screen here.
 *   deliberate  intentionally absent or different; `note` says why. Mirrors a
 *               section of PARITY.md.
 *   gap         wanted but not built yet; `note` says what is missing. Reported,
 *               never failing — a gap is allowed to exist, an unrecorded one is not.
 *
 * Paths in `web` are relative to the web repo, paths in `ios` to this one.
 */

export const FEATURE_MAP = [
  // --- Pages -------------------------------------------------------------
  { web: 'app/page.tsx', status: 'deliberate', note: 'Marketing landing page. The app opens straight to sign-in or Home.' },
  { web: 'app/(auth)/sign-in/page.tsx', status: 'ported', ios: ['src/app/(auth)/sign-in.tsx'] },
  { web: 'app/protected/page.tsx', status: 'ported', ios: ['src/app/(tabs)/index.tsx'] },
  { web: 'app/protected/transactions/page.tsx', status: 'ported', ios: ['src/features/transactions/month-view.tsx', 'src/app/(tabs)/transactions/index.tsx'] },
  { web: 'app/protected/year/page.tsx', status: 'ported', ios: ['src/features/year/year-view.tsx', 'src/app/(tabs)/transactions/year.tsx'] },
  { web: 'app/protected/add/page.tsx', status: 'ported', ios: ['src/app/transaction/new.tsx'] },
  { web: 'app/protected/edit/[id]/page.tsx', status: 'ported', ios: ['src/app/transaction/[id].tsx'] },
  { web: 'app/protected/search/page.tsx', status: 'ported', ios: ['src/features/search/search-view.tsx', 'src/app/(tabs)/transactions/search.tsx'] },
  { web: 'app/protected/filter/page.tsx', status: 'ported', ios: ['src/features/filter/filter-view.tsx', 'src/app/(tabs)/transactions/filter.tsx'] },
  { web: 'app/protected/category/[category]/page.tsx', status: 'ported', ios: ['src/features/category/category-view.tsx', 'src/app/(tabs)/transactions/category/[category].tsx'] },
  { web: 'app/protected/category/[category]/[subcategory]/page.tsx', status: 'ported', ios: ['src/app/(tabs)/transactions/category/[category]/[subcategory].tsx'] },
  { web: 'app/protected/budgets/page.tsx', status: 'ported', ios: ['src/features/budgets/budgets-view.tsx', 'src/app/(tabs)/budgets.tsx'] },
  { web: 'app/protected/budgets/add/page.tsx', status: 'ported', ios: ['src/app/budget/new.tsx'] },
  { web: 'app/protected/budgets/edit/[id]/page.tsx', status: 'ported', ios: ['src/app/budget/[id].tsx'] },
  { web: 'app/protected/settings/page.tsx', status: 'ported', ios: ['src/app/(tabs)/settings.tsx', 'src/features/settings/components/bank-integrations.tsx'], note: 'Bank connect, re-authenticate and disconnect open the web app in a browser.' },
  { web: 'app/protected/reset-password/page.tsx', status: 'ported', ios: ['src/app/change-password.tsx', 'src/features/auth/change-password-form.tsx'] },
  { web: 'app/protected/admin/page.tsx', status: 'deliberate', note: 'Admin tools (fund-category CRUD, CSV import, exchange-rate retry, delete-all) are not offered on mobile, by decision.' },

  // --- API routes --------------------------------------------------------
  { web: 'app/api/cron/sync/route.ts', status: 'ported', ios: ['src/features/settings/mutations.ts'], note: 'Called per account by "Fetch now".' },
  { web: 'app/api/pending-transactions/[id]/route.ts', status: 'ported', ios: ['src/features/pending/queries.ts'], note: 'Updates the pending row directly, RLS-scoped.' },
  { web: 'app/api/enable-banking/update-mapping/route.ts', status: 'ported', ios: ['src/features/settings/mutations.ts'], note: 'Writes the account settings directly, RLS-scoped.' },
  { web: 'app/api/transactions/bulk-fetch/route.ts', status: 'deliberate', note: 'Per-account "Fetch now" in Settings covers it.' },
  { web: 'app/api/enable-banking/auth/route.ts', status: 'deliberate', note: 'Bank connection happens in the browser, on the web app.' },
  { web: 'app/api/enable-banking/callback/route.ts', status: 'deliberate', note: 'Bank connection happens in the browser, on the web app.' },
  { web: 'app/api/enable-banking/disconnect/route.ts', status: 'deliberate', note: 'Bank connection happens in the browser, on the web app.' },
  { web: 'app/api/trade-republic/auth/route.ts', status: 'deliberate', note: 'Trade Republic connect and re-authenticate happen on the web app.' },
  { web: 'app/api/trade-republic/disconnect/route.ts', status: 'deliberate', note: 'Trade Republic disconnect happens on the web app.' },

  // --- Feature components ------------------------------------------------
  { web: 'components/features/balance.tsx', status: 'ported', ios: ['src/features/funds/balance-card.tsx'] },
  { web: 'components/features/at-a-glance-card.tsx', status: 'ported', ios: ['src/features/home/at-a-glance-card.tsx'] },
  { web: 'components/features/net-worth-card.tsx', status: 'ported', ios: ['src/features/home/net-worth-card.tsx', 'src/features/balance/balance-chart.tsx'] },
  { web: 'components/features/budget-card.tsx', status: 'ported', ios: ['src/features/budgets/budgets-view.tsx'] },
  { web: 'components/features/budget-form.tsx', status: 'ported', ios: ['src/features/budgets/budget-form.tsx'] },
  { web: 'components/features/category-chart.tsx', status: 'ported', ios: ['src/features/category/category-chart.tsx'] },
  { web: 'components/features/filter-controls.tsx', status: 'ported', ios: ['src/features/filter/components/filter-sheet.tsx'] },
  { web: 'components/features/no-transactions.tsx', status: 'ported', ios: ['src/components/empty-state.tsx'] },
  { web: 'components/features/pending-transactions-button.tsx', status: 'ported', ios: ['src/features/pending/components/pending-banner.tsx'], note: 'A tab badge and a banner replace the floating bell.' },
  { web: 'components/features/search-summary.tsx', status: 'ported', ios: ['src/features/search/components/search-summary.tsx'] },
  { web: 'components/features/transaction-form-modal.tsx', status: 'ported', ios: ['src/features/transactions/form/transaction-form.tsx'] },
  { web: 'components/features/transaction-form-html-design.tsx', status: 'deliberate', note: 'The web modal and standalone add/edit pages are one sheet here (PARITY.md, "Screens merged").' },
  { web: 'components/features/transaction-summary.tsx', status: 'ported', ios: ['src/features/transactions/components/month-summary-card.tsx', 'src/features/year/year-view.tsx'] },
  { web: 'components/features/transactions-table-optimized.tsx', status: 'ported', ios: ['src/features/transactions/components/transaction-row.tsx', 'src/features/transactions/components/day-header.tsx'] },
  { web: 'components/features/fund-categories-manager.tsx', status: 'deliberate', note: 'Part of the admin tools, which are not offered on mobile.' },

  // --- Layout components -------------------------------------------------
  { web: 'components/layout/navigation.tsx', status: 'ported', ios: ['src/app/(tabs)/_layout.tsx'] },
  { web: 'components/layout/background-sync-provider.tsx', status: 'ported', ios: ['src/features/sync/use-remote-changes.ts', 'src/features/sync/remote-change-banner.tsx'] },
  { web: 'components/layout/privacy-provider.tsx', status: 'ported', ios: ['src/features/privacy/privacy-provider.tsx'] },
  { web: 'components/layout/privacy-toggle.tsx', status: 'ported', ios: ['src/app/(tabs)/settings.tsx'], note: 'A switch in Settings, with a preview.' },
  { web: 'components/layout/theme-toggle.tsx', status: 'ported', ios: ['src/features/appearance/theme-preference-picker.tsx'] },
  { web: 'components/layout/user-menu.tsx', status: 'ported', ios: ['src/app/(tabs)/settings.tsx'], note: 'Account, change password and sign out live in Settings.' },
  { web: 'components/layout/header-auth.tsx', status: 'deliberate', note: 'The web header and its hard-coded display names; iOS shows the signed-in email in Settings.' },
  { web: 'components/layout/hero.tsx', status: 'deliberate', note: 'Landing page only.' },
  { web: 'components/layout/env-var-warning.tsx', status: 'deliberate', note: 'Template artifact. iOS fails fast on missing config (lib/supabase.ts).' },

  // --- Known gaps (files outside the scanned surfaces) -------------------
  { web: 'components/ui/hidden-transactions-tooltip.tsx', status: 'gap', note: 'Hidden-from-totals breakdown (count, income, expense, net) on the month and year summaries. Month shows only the hidden-expense total.' },
];
