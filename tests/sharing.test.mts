import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and window for Node environment
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
  writable: true,
});
if (!globalThis.window) {
  (globalThis as unknown as { window: unknown }).window = {
    location: {
      origin: 'https://visiospace.app',
      pathname: '/',
    },
  };
}

import { sharingService } from '../src/services/sharingService.ts';
import type { BoardRole } from '../src/types/board.ts';

test('sharingService.buildShareUrl generates correct URL structures for viewers and editors', () => {
  const viewerUrl = sharingService.buildShareUrl('board-123', 'tok_abc', 'viewer');
  assert.equal(viewerUrl, 'https://visiospace.app/#board/board-123?token=tok_abc&role=viewer');

  const editorUrl = sharingService.buildShareUrl('board-123', 'tok_abc', 'editor');
  assert.equal(editorUrl, 'https://visiospace.app/#board/board-123?token=tok_abc&role=editor');

  const privateUrl = sharingService.buildShareUrl('board-123', 'tok_abc', 'private');
  // Private defaults to viewer role parameter for safety
  assert.equal(privateUrl, 'https://visiospace.app/#board/board-123?token=tok_abc&role=viewer');
});

test('sharingService manages share settings and access levels in local fallback mode', async () => {
  const boardId = 'board-test-sharing-1';

  const initialSettings = await sharingService.getShareSettings(boardId);
  assert.equal(initialSettings.boardId, boardId);
  assert.equal(initialSettings.publicAccess, 'private');
  assert.ok(initialSettings.shareToken.length >= 8);
  assert.ok(initialSettings.shareUrl.includes(initialSettings.shareToken));

  // Update to viewer
  await sharingService.updatePublicAccess(boardId, 'viewer');
  const viewerSettings = await sharingService.getShareSettings(boardId);
  assert.equal(viewerSettings.publicAccess, 'viewer');
  assert.ok(viewerSettings.shareUrl.includes('role=viewer'));

  // Update to editor
  await sharingService.updatePublicAccess(boardId, 'editor');
  const editorSettings = await sharingService.getShareSettings(boardId);
  assert.equal(editorSettings.publicAccess, 'editor');
  assert.ok(editorSettings.shareUrl.includes('role=editor'));
});

test('sharingService manages collaborators roster in local fallback mode', async () => {
  const boardId = 'board-test-collaborators';

  // Initial fetch returns current user as owner
  const initialList = await sharingService.getCollaborators(boardId, 'user-owner-1');
  assert.equal(initialList.length, 1);
  assert.equal(initialList[0].role, 'owner');

  // Invite an editor
  const inviteResult = await sharingService.inviteCollaborator(boardId, 'alice_designer', 'editor');
  assert.ok(inviteResult.success);
  assert.equal(inviteResult.collaborator?.username, 'alice_designer');
  assert.equal(inviteResult.collaborator?.role, 'editor');

  // Duplicate invite fails gracefully
  const dupResult = await sharingService.inviteCollaborator(boardId, '@alice_designer', 'viewer');
  assert.equal(dupResult.success, false);
  assert.ok(dupResult.error?.includes('already a collaborator'));

  // Invite a viewer
  const inviteViewer = await sharingService.inviteCollaborator(boardId, 'bob_stakeholder', 'viewer');
  assert.ok(inviteViewer.success);

  let roster = await sharingService.getCollaborators(boardId);
  assert.equal(roster.length, 3);

  // Update role of bob from viewer to editor
  const bob = roster.find(c => c.username === 'bob_stakeholder')!;
  await sharingService.updateCollaboratorRole(boardId, bob.userId, 'editor');

  roster = await sharingService.getCollaborators(boardId);
  const updatedBob = roster.find(c => c.username === 'bob_stakeholder')!;
  assert.equal(updatedBob.role, 'editor');

  // Remove alice
  const alice = roster.find(c => c.username === 'alice_designer')!;
  await sharingService.removeCollaborator(boardId, alice.userId);

  roster = await sharingService.getCollaborators(boardId);
  assert.equal(roster.length, 2);
  assert.ok(!roster.some(c => c.username === 'alice_designer'));
});

test('sharingService.resolveUserRole resolves roles correctly based on ownership, token, and access', async () => {
  const boardId = 'board-role-resolver-test';

  // Setup board share config
  await sharingService.updatePublicAccess(boardId, 'private');
  const settings = await sharingService.getShareSettings(boardId);
  const validToken = settings.shareToken;

  // Add collaborator with editor role
  await sharingService.getCollaborators(boardId, 'owner-user');
  const invited = await sharingService.inviteCollaborator(boardId, 'member-123', 'editor');
  const memberUserId = invited.collaborator!.userId;

  // 1. Collaborator in member list resolves to their role
  const resolvedMemberRole = await sharingService.resolveUserRole(boardId, memberUserId);
  assert.equal(resolvedMemberRole, 'editor');

  // 2. Private board without token for unknown user resolves to viewer (read-only default)
  const unknownUserRole = await sharingService.resolveUserRole(boardId, 'stranger-id');
  assert.equal(unknownUserRole, 'viewer');

  // 3. Board with public editor access + valid token resolves to editor
  await sharingService.updatePublicAccess(boardId, 'editor');
  const publicEditorRole = await sharingService.resolveUserRole(boardId, 'guest-user', validToken, 'editor');
  assert.equal(publicEditorRole, 'editor');

  // 4. Board with public viewer access + valid token resolves to viewer even if query param requested editor
  await sharingService.updatePublicAccess(boardId, 'viewer');
  const publicViewerRole = await sharingService.resolveUserRole(boardId, 'guest-user', validToken, 'editor');
  assert.equal(publicViewerRole, 'viewer');
});

test('role permissions matrix: owner and editor can edit; viewer is strictly read-only', () => {
  const canEdit = (role: BoardRole) => role === 'owner' || role === 'editor';

  assert.equal(canEdit('owner'), true, 'Owner must have editing permissions');
  assert.equal(canEdit('editor'), true, 'Editor must have editing permissions');
  assert.equal(canEdit('viewer'), false, 'Viewer must NOT have editing permissions');
});
