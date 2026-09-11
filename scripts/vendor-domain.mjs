#!/usr/bin/env node

/**
 * Vendors the pure domain logic from the web app into `src/domain/`.
 *
 * For each entry in DOMAIN_MAP this copies the upstream file, rewrites `@/`
 * import aliases to relative paths, and prepends a provenance header recording
 * the upstream path and the hash of the alias-rewritten content.
 *
 * The hash is deliberately computed *after* alias rewriting, so the invariant
 * is simply: hash(everything below the header) === hash(rewrite(upstream)).
 *
 * Run via `npm run vendor`. Pass `--check` to report what would change without
 * writing (used by parity-check).
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DOMAIN_MAP,
  WEB_REPO,
  buildHeader,
  rewriteAliases,
} from './domain-map.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN_DIR = join(ROOT, 'src', 'domain');

const checkOnly = process.argv.includes('--check');
const vendoredOn = new Date().toISOString().slice(0, 10);

/**
 * @param {string} text
 * @returns {string} Hex sha256 digest.
 */
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * Reads an upstream file and returns its alias-rewritten content and hash.
 *
 * @param {string} upstreamPath Path relative to the web repo root.
 * @returns {Promise<{content: string, hash: string}>}
 */
async function readUpstream(upstreamPath) {
  const raw = await readFile(join(WEB_REPO, upstreamPath), 'utf8');
  const content = rewriteAliases(raw, upstreamPath);
  return { content, hash: sha256(content) };
}

async function main() {
  await mkdir(DOMAIN_DIR, { recursive: true });

  let written = 0;

  for (const entry of DOMAIN_MAP) {
    const { content, hash } = await readUpstream(entry.upstream);
    const target = join(DOMAIN_DIR, entry.local);
    const next = buildHeader(entry, hash, vendoredOn) + content;

    let previous = null;
    try {
      previous = await readFile(target, 'utf8');
    } catch {
      // First vendoring — no existing file to compare against.
    }

    if (previous === next) {
      console.log(`  unchanged  ${entry.local}`);
      continue;
    }

    if (checkOnly) {
      console.log(`  would-write ${entry.local}`);
      written += 1;
      continue;
    }

    await writeFile(target, next, 'utf8');
    const verb = previous === null ? 'created' : 'updated';
    console.log(`  ${verb.padEnd(10)} ${entry.local}  (${hash.slice(0, 12)})`);
    written += 1;
  }

  console.log(
    checkOnly
      ? `\n${written} file(s) out of date. Run \`npm run vendor\` to refresh.`
      : `\n${written} file(s) written to src/domain/.`,
  );
}

main().catch((error) => {
  console.error(`\nvendor-domain failed: ${error.message}\n`);
  process.exit(1);
});
