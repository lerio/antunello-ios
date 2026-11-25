/**
 * Tests for searching Lucide icons by name and tag.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ICON_NAMES, pascalName, searchIcons } from '@/features/categories/icon-search';

describe('icon names', () => {
  it('turns kebab-case into Lucide component names', () => {
    assert.equal(pascalName('arrow-right-left'), 'ArrowRightLeft');
    assert.equal(pascalName('gamepad-2'), 'Gamepad2');
    assert.equal(pascalName('house'), 'House');
  });

  it('covers the whole icon set', () => {
    assert.ok(ICON_NAMES.length > 2000);
  });
});

describe('searching icons', () => {
  it('returns every icon for an empty query', () => {
    assert.equal(searchIcons('  ').length, ICON_NAMES.length);
  });

  it('ranks a whole-word name match first', () => {
    assert.equal(searchIcons('utensils')[0].name, 'Utensils');
  });

  it('finds icons by tag, not only by name', () => {
    const names = searchIcons('money').map((icon) => icon.name);
    assert.ok(names.includes('Banknote'), 'Banknote is tagged "money"');
  });

  it('requires every term to match', () => {
    const names = searchIcons('arrow left').map((icon) => icon.name);
    assert.ok(names.includes('ArrowLeft'));
    assert.ok(searchIcons('zzzzqqq').length === 0);
  });
});
