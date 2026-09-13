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

import { activityService } from '../src/services/activityService.ts';

test('activityService logs and retrieves activities in chronological order', async () => {
  storage.clear();
  const boardId = 'board-activity-test-1';

  // 1. Log card addition
  const item1 = await activityService.logActivity(boardId, {
    action: 'card_add',
    description: 'added sticky card "User Feedback A"',
    user: { id: 'u1', name: 'Alex' },
    metadata: { cardId: 'card-1' },
  });

  assert.ok(item1.id.startsWith('act_'));
  assert.equal(item1.boardId, boardId);
  assert.equal(item1.action, 'card_add');
  assert.equal(item1.userName, 'Alex');

  // 2. Log comment resolution
  const item2 = await activityService.logActivity(boardId, {
    action: 'comment_resolve',
    description: 'resolved comment on card "User Feedback A"',
    user: { id: 'u2', name: 'Sarah' },
    metadata: { commentId: 'comm-1' },
  });

  // 3. Log version restoration
  const item3 = await activityService.logActivity(boardId, {
    action: 'version_restore',
    description: 'restored board to version "Sprint 1 Final"',
    user: { id: 'u1', name: 'Alex' },
    metadata: { snapshotName: 'Sprint 1 Final' },
  });

  // Fetch activities
  const activities = await activityService.getActivities(boardId);
  assert.equal(activities.length, 3);
  // Newest first
  assert.equal(activities[0].id, item3.id);
  assert.equal(activities[0].action, 'version_restore');
  assert.equal(activities[1].id, item2.id);
  assert.equal(activities[1].action, 'comment_resolve');
  assert.equal(activities[2].id, item1.id);
  assert.equal(activities[2].action, 'card_add');
});
