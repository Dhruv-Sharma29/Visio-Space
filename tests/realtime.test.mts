import test from 'node:test';
import assert from 'node:assert/strict';
import { getCollaboratorColor, COLLABORATOR_COLORS } from '../src/utils/realtimeColor.ts';

test('getCollaboratorColor generates deterministic colors for users', () => {
  const user1 = 'user-abc-123';
  const color1 = getCollaboratorColor(user1);
  const color2 = getCollaboratorColor(user1);

  // Must be deterministic
  assert.equal(color1, color2);

  // Must be one of the curated colors
  const hexes = COLLABORATOR_COLORS.map(c => c.hex);
  assert.ok(hexes.includes(color1));

  // Different users get valid colors
  const colorB = getCollaboratorColor('user-xyz-789');
  assert.ok(hexes.includes(colorB));
});

test('collaborator palette has high-contrast colors with valid hex formats', () => {
  assert.equal(COLLABORATOR_COLORS.length, 8);
  for (const c of COLLABORATOR_COLORS) {
    assert.match(c.hex, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(c.name.length > 0);
  }
});
