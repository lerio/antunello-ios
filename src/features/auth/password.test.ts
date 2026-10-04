/**
 * Tests for password-change validation.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateNewPassword } from '@/features/auth/password';

describe('validateNewPassword', () => {
  it('requires both fields', () => {
    const message = 'Password and confirm password are required';
    assert.equal(validateNewPassword('', ''), message);
    assert.equal(validateNewPassword('secret', ''), message);
    assert.equal(validateNewPassword('', 'secret'), message);
  });

  it('requires the two to match', () => {
    assert.equal(validateNewPassword('secret1', 'secret2'), 'Passwords do not match');
  });

  it('accepts a matching pair, leaving strength to the server', () => {
    assert.equal(validateNewPassword('a', 'a'), null);
    assert.equal(validateNewPassword('correct horse', 'correct horse'), null);
  });
});
