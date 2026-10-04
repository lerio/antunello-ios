/**
 * Tests for the theme preference's pure parts.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { colorSchemeFor, parseThemePreference } from '@/features/appearance/theme-preference';

describe('parseThemePreference', () => {
  it('accepts the two forced schemes', () => {
    assert.equal(parseThemePreference('light'), 'light');
    assert.equal(parseThemePreference('dark'), 'dark');
  });

  it('falls back to system for anything else', () => {
    assert.equal(parseThemePreference('system'), 'system');
    assert.equal(parseThemePreference(null), 'system');
    assert.equal(parseThemePreference(undefined), 'system');
    assert.equal(parseThemePreference('sepia'), 'system');
    assert.equal(parseThemePreference(''), 'system');
  });
});

describe('colorSchemeFor', () => {
  it('forces light and dark, and releases the override for system', () => {
    assert.equal(colorSchemeFor('light'), 'light');
    assert.equal(colorSchemeFor('dark'), 'dark');
    assert.equal(colorSchemeFor('system'), 'unspecified');
  });
});
