#!/usr/bin/env node

/**
 * Detects drift between `src/domain/` and its upstream sources in the web app.
 *
 * Three independent sha256 hashes are compared per file:
 *
 *   expected  hash(rewrite(upstream file, as it is right now))
 *   recorded  the @upstream-sha256 stamped into the local provenance header
 *   actual    hash(local file with its provenance header stripped)
 *
 * Which yields four distinguishable states:
 *
 *   OK             expected === recorded === actual
 *   UPSTREAM-DRIFT expected !== recorded  — the web app changed; re-vendor
 *   LOCAL-DRIFT    expected === recorded, actual !== expected — the copy was
 *                  hand-edited and no longer matches what it claims to be
 *   NO-HEADER      the file carries no provenance header at all
 *
 * It also checks feature coverage (see feature-check.mjs): every web page, API
 * route and feature component must have a status in feature-map.mjs.
 *
 * Exit code is 1 if anything is not OK, so this can gate a commit hook.
 *
 * Run via `npm run parity`.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkFeatures } from './feature-check.mjs';
import {
  DOMAIN_MAP,
  HEADER_MARKER,
  WEB_REPO,
  rewriteAliases,
  stripHeader,
} from './domain-map.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN_DIR = join(ROOT, 'src', 'domain');

/**
 * @param {string} text
 * @returns {string} Hex sha256 digest.
 */
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * Extracts the `@upstream-sha256` value from a provenance header.
 *
 * @param {string} content Local file contents.
 * @returns {string|null} The recorded digest, or null if absent.
 */
function readRecordedHash(content) {
  const match = content.match(/@upstream-sha256\s+([0-9a-f]{64})/);
  return match ? match[1] : null;
}

async function checkEntry(entry) {
  const localPath = join(DOMAIN_DIR, entry.local);
  const local = await readFile(localPath, 'utf8');

  if (!local.includes(HEADER_MARKER)) {
    return { status: 'NO-HEADER', entry };
  }

  const recorded = readRecordedHash(local);
  const actual = sha256(stripHeader(local));

  let expected = null;
  try {
    const raw = await readFile(join(WEB_REPO, entry.upstream), 'utf8');
    expected = sha256(rewriteAliases(raw, entry.upstream));
  } catch {
    return { status: 'UPSTREAM-GONE', entry };
  }

  if (expected !== recorded) return { status: 'UPSTREAM-DRIFT', entry, expected, recorded };
  if (actual !== expected) return { status: 'LOCAL-DRIFT', entry, expected, actual };
  return { status: 'OK', entry };
}

/**
 * Finds files in src/domain carrying a provenance header but missing from
 * DOMAIN_MAP — otherwise a new vendored file would escape drift detection.
 *
 * @returns {Promise<string[]>} Unlisted filenames.
 */
async function findUnlisted() {
  const files = await readdir(DOMAIN_DIR).catch(() => []);
  const listed = new Set(DOMAIN_MAP.map((e) => e.local));
  const unlisted = [];

  for (const file of files) {
    if (!file.endsWith('.ts') || listed.has(file)) continue;
    const content = await readFile(join(DOMAIN_DIR, file), 'utf8');
    if (content.includes(HEADER_MARKER)) unlisted.push(file);
  }
  return unlisted;
}

async function main() {
  const results = [];
  for (const entry of DOMAIN_MAP) results.push(await checkEntry(entry));

  const problems = results.filter((r) => r.status !== 'OK');
  const unlisted = await findUnlisted();

  for (const { status, entry } of results) {
    const label = status === 'OK' ? 'ok           ' : status.padEnd(13);
    console.log(`  ${label} ${entry.local.padEnd(32)} <- ${entry.upstream}`);
  }

  if (problems.length === 0) {
    console.log(`\n${results.length} vendored file(s) in sync with ${WEB_REPO}`);
  } else {
    console.log(`\n${problems.length} file(s) need attention:`);
    for (const { status, entry } of problems) {
      if (status === 'UPSTREAM-DRIFT') {
        console.log(
          `\n  ${entry.upstream} changed upstream.\n` +
            `    Review it:  git -C ${WEB_REPO} diff -- ${entry.upstream}\n` +
            `    Then:       npm run vendor   (and regenerate fixtures if behaviour moved)`,
        );
      } else if (status === 'LOCAL-DRIFT') {
        console.log(
          `\n  ${entry.local} was edited locally and no longer matches its header.\n` +
            `    Either revert it, or make the change upstream first and re-vendor.`,
        );
      } else if (status === 'UPSTREAM-GONE') {
        console.log(`\n  ${entry.upstream} no longer exists in ${WEB_REPO}.`);
      } else {
        console.log(`\n  ${entry.local} has no provenance header.`);
      }
    }
  }

  if (unlisted.length > 0) {
    console.log(
      `\n  Vendored but unlisted in DOMAIN_MAP (not drift-checked):\n` +
        unlisted.map((f) => `    ${f}`).join('\n'),
    );
  }

  const features = await checkFeatures(WEB_REPO, ROOT);
  const { ported, deliberate, gap } = features.counts;

  console.log(`\nFeatures: ${ported} ported, ${deliberate} deliberate, ${gap} known gap(s)`);
  for (const entry of features.gaps) console.log(`  gap           ${entry.web}\n                ${entry.note}`);

  if (features.problems.length > 0) {
    console.log(`\n${features.problems.length} feature problem(s):\n`);
    for (const problem of features.problems) console.log(`  ${problem}`);
  }

  const ok = problems.length === 0 && unlisted.length === 0 && features.problems.length === 0;
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nparity-check failed: ${error.message}\n`);
  process.exit(1);
});
