/**
 * The single source of truth for which files are vendored from the web app.
 *
 * Each entry maps a file in the web repo (`antunello-app`) to its local copy in
 * `src/domain/`. The vendored files are the pure, I/O-free half of the business
 * logic — no React, no DOM, no Supabase. Their only imports are each other.
 *
 * The parity machinery in `vendor-domain.mjs` and `parity-check.mjs` both read
 * this map, so adding a file here is the only step needed to bring it under
 * drift detection.
 *
 * `@/` import aliases from the web repo are rewritten to relative paths (see
 * ALIAS_REWRITES). Everything else is copied byte-for-byte, so an `exact` entry
 * stays diffable against its upstream source.
 */

/** Absolute path to the web app, overridable for CI or a different checkout. */
export const WEB_REPO =
  process.env.WEB_REPO ?? '/Users/you/Sources/personal/antunello-app';

/**
 * Web-repo import alias → local relative specifier.
 *
 * Only specifiers on files that are themselves vendored appear here. If a
 * vendored file ever imports something NOT in this map, `vendor-domain.mjs`
 * fails loudly rather than emitting a broken import.
 */
export const ALIAS_REWRITES = {
  '@/types/database': './types',
  '@/utils/number': './number',
  '@/utils/date': './date',
  '@/utils/currency-amount-input': './currency-amount-input',
  '@/utils/form-validation': './form-validation',
  '@/utils/money-transfer-validation': './money-transfer-validation',
  '@/utils/transaction-utils': './transaction-utils',
  '@/utils/tr-bonuses': './tr-bonuses',
  '@/utils/split-transactions': './split-transactions',
  '@/constants/app-constants': './app-constants',
};

/**
 * The vendored file set.
 *
 * `parity` follows the vocabulary documented in PARITY.md:
 *   exact     — byte-identical upstream except the import block
 *   adapted   — same logic, changed imports or I/O
 *   rewritten — reimplemented to match observable behaviour (not vendored;
 *               these live outside src/domain and appear here only to document
 *               provenance, with `vendored: false`)
 */
export const DOMAIN_MAP = [
  { upstream: 'types/database.ts', local: 'types.ts', parity: 'exact' },
  { upstream: 'constants/app-constants.ts', local: 'app-constants.ts', parity: 'exact' },
  { upstream: 'utils/number.ts', local: 'number.ts', parity: 'exact' },
  { upstream: 'utils/date.ts', local: 'date.ts', parity: 'exact' },
  {
    upstream: 'utils/currency-amount-input.ts',
    local: 'currency-amount-input.ts',
    parity: 'exact',
  },
  { upstream: 'utils/form-validation.ts', local: 'form-validation.ts', parity: 'exact' },
  {
    upstream: 'utils/money-transfer-validation.ts',
    local: 'money-transfer-validation.ts',
    parity: 'exact',
  },
  { upstream: 'utils/transaction-utils.ts', local: 'transaction-utils.ts', parity: 'exact' },
  { upstream: 'utils/tr-bonuses.ts', local: 'tr-bonuses.ts', parity: 'exact' },
  {
    upstream: 'utils/split-transactions.ts',
    local: 'split-transactions.ts',
    parity: 'exact',
  },
];

/** Marker line that identifies a file as vendored and locates its header. */
export const HEADER_MARKER = '@vendored-from';

/**
 * Rewrites web-repo import aliases to local relative specifiers.
 *
 * Throws on an unmapped `@/` specifier so a new upstream import can never slip
 * through as a silently broken path.
 *
 * @param {string} content Raw file contents from the web repo.
 * @param {string} upstreamPath Upstream path, for error messages only.
 * @returns {string} Contents with aliases rewritten.
 */
export function rewriteAliases(content, upstreamPath) {
  return content.replace(
    /(from\s+(['"]))(@\/[^'"]+)(\2)/g,
    (match, pre, _quote, specifier, post) => {
      const mapped = ALIAS_REWRITES[specifier];
      if (!mapped) {
        throw new Error(
          `Unmapped import in ${upstreamPath}: "${specifier}". ` +
            `Add it to ALIAS_REWRITES (and vendor the target) before vendoring this file.`,
        );
      }
      return `${pre}${mapped}${post}`;
    },
  );
}

/**
 * Builds the provenance header prepended to every vendored file.
 *
 * @param {{upstream: string, local: string, parity: string}} entry Map entry.
 * @param {string} upstreamSha256 Hash of the alias-rewritten upstream content.
 * @param {string} vendoredOn ISO date (YYYY-MM-DD).
 * @returns {string} A comment block, newline-terminated.
 */
export function buildHeader(entry, upstreamSha256, vendoredOn) {
  return [
    '/**',
    ` * ${HEADER_MARKER} antunello-app:${entry.upstream}`,
    ` * @upstream-sha256 ${upstreamSha256}`,
    ` * @vendored-on ${vendoredOn}`,
    ` * @parity ${entry.parity}`,
    ' * @divergences none',
    ' *',
    ' * DO NOT EDIT THIS COPY IN ISOLATION.',
    ' *',
    ' * This file is vendored verbatim from the web app. The hash above is of the',
    ' * upstream file after alias rewriting; it must equal the hash of everything',
    ' * below this header. If you change the web implementation, re-run',
    ' * `npm run vendor` and follow PARITY.md.',
    ' */',
    '',
  ].join('\n');
}

/**
 * Strips a provenance header from local file contents, returning the body that
 * the upstream hash is expected to match.
 *
 * @param {string} content Local file contents.
 * @returns {string} Contents with the header block removed.
 */
export function stripHeader(content) {
  if (!content.startsWith('/**')) return content;
  const end = content.indexOf('*/\n');
  if (end === -1) return content;
  const header = content.slice(0, end);
  if (!header.includes(HEADER_MARKER)) return content;
  return content.slice(end + 3).replace(/^\n+/, '');
}
