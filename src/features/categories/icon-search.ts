/**
 * Searching Lucide icons by name and by tag, as lucide.dev does.
 *
 * Tags are vendored from the `lucide-static` package (`tags.json`, minified to
 * `name -> "tag,tag"`), the same file the web app ships, because the React
 * packages carry no keywords.
 */

import tags from '@/features/categories/lucide-icon-tags.json';

/** `"arrow-right-left"` -> `"ArrowRightLeft"`; `"gamepad-2"` -> `"Gamepad2"`. */
export function pascalName(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const TAGS = tags as Record<string, string>;

/** Every icon, as `{ kebab, name }` with `name` the Lucide component name. */
export const ICON_NAMES: readonly { kebab: string; name: string }[] = Object.keys(TAGS).map(
  (kebab) => ({ kebab, name: pascalName(kebab) }),
);

/**
 * Ranks one term against an icon: 0 whole word in the name, 1 name prefix,
 * 2 whole tag, 3 tag prefix, 4 substring of the name; -1 for no match.
 */
function rankTerm(nameWords: string[], iconTags: string[], term: string): number {
  if (nameWords.includes(term)) return 0;
  if (nameWords.some((word) => word.startsWith(term))) return 1;
  if (iconTags.includes(term)) return 2;
  if (iconTags.some((tag) => tag.startsWith(term) || tag.split(' ').some((word) => word.startsWith(term)))) {
    return 3;
  }
  if (nameWords.join('').includes(term)) return 4;
  return -1;
}

/**
 * The icons matching a query, best first. An empty query matches every icon.
 * Every whitespace-separated term has to match; an icon ranks by its worst term.
 */
export function searchIcons(query: string): { kebab: string; name: string }[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...ICON_NAMES];

  return ICON_NAMES.map((icon) => {
    const nameWords = icon.kebab.split('-');
    const iconTags = TAGS[icon.kebab] ? TAGS[icon.kebab].split(',') : [];
    let worst = 0;
    for (const term of terms) {
      const score = rankTerm(nameWords, iconTags, term);
      if (score < 0) return { icon, score: -1 };
      worst = Math.max(worst, score);
    }
    return { icon, score: worst };
  })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.icon.kebab.length - b.icon.kebab.length)
    .map((entry) => entry.icon);
}
