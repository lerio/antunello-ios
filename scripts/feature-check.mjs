/**
 * Feature coverage: does every web surface have a recorded iOS status?
 *
 * Counterpart to the hash check in `parity-check.mjs`. That one notices when
 * shared *code* changes; this one notices when the web app grows a *feature* —
 * a page, an API route, a feature component — that `feature-map.mjs` has never
 * heard of.
 */

import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { FEATURE_MAP } from './feature-map.mjs';

const STATUSES = new Set(['ported', 'deliberate', 'gap']);

/** Surfaces that must be classified, as predicates over a web-relative path. */
const SURFACES = [
  { dir: 'app', test: (p) => /(^|\/)page\.tsx$/.test(p) || /(^|\/)route\.ts$/.test(p) },
  { dir: 'components/features', test: (p) => p.endsWith('.tsx') && !p.includes('/') },
  { dir: 'components/layout', test: (p) => p.endsWith('.tsx') && !p.includes('/') },
];

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

/**
 * Every classifiable surface currently in the web repo.
 *
 * @param {string} webRepo
 * @returns {Promise<string[]>} Web-relative paths with forward slashes, sorted.
 */
async function scanWebSurfaces(webRepo) {
  const found = [];

  for (const { dir, test } of SURFACES) {
    const entries = await readdir(join(webRepo, dir), { recursive: true }).catch(() => []);
    for (const entry of entries) {
      const relative = entry.split('\\').join('/');
      if (test(relative)) found.push(`${dir}/${relative}`);
    }
  }

  return found.sort();
}

/**
 * @param {string} webRepo Absolute path to the web app.
 * @param {string} iosRoot Absolute path to this repo.
 * @returns {Promise<{ problems: string[], gaps: typeof FEATURE_MAP, counts: Record<string, number> }>}
 */
export async function checkFeatures(webRepo, iosRoot) {
  const problems = [];
  const listed = new Set();

  for (const entry of FEATURE_MAP) {
    if (listed.has(entry.web)) problems.push(`DUPLICATE      ${entry.web} is listed twice`);
    listed.add(entry.web);

    if (!STATUSES.has(entry.status)) {
      problems.push(`BAD-STATUS     ${entry.web} has status "${entry.status}"`);
      continue;
    }
    if (entry.status !== 'ported' && !entry.note) {
      problems.push(`NO-NOTE        ${entry.web} is ${entry.status} and needs a note saying why`);
    }
    if (entry.status === 'ported' && !(entry.ios?.length > 0)) {
      problems.push(`NO-IOS         ${entry.web} is ported but names no iOS files`);
    }

    if (!(await exists(join(webRepo, entry.web)))) {
      problems.push(`WEB-GONE       ${entry.web} no longer exists; update or remove its entry`);
    }
    for (const file of entry.ios ?? []) {
      if (!(await exists(join(iosRoot, file)))) {
        problems.push(`IOS-MISSING    ${file} (for ${entry.web}) does not exist`);
      }
    }
  }

  for (const surface of await scanWebSurfaces(webRepo)) {
    if (!listed.has(surface)) {
      problems.push(
        `UNCLASSIFIED   ${surface}\n` +
          `               New on the web app. Port it (and add an entry with status 'ported'),\n` +
          `               or record why not (status 'deliberate'), or log it as a 'gap' in scripts/feature-map.mjs.`,
      );
    }
  }

  const counts = { ported: 0, deliberate: 0, gap: 0 };
  for (const { status } of FEATURE_MAP) if (status in counts) counts[status] += 1;

  return { problems, gaps: FEATURE_MAP.filter((e) => e.status === 'gap'), counts };
}
