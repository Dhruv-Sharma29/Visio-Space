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

import { versionService } from '../src/services/versionService.ts';
import type { BoardState } from '../src/types/board.ts';

test('versionService creates and retrieves snapshots in local fallback mode', async () => {
  storage.clear();
  const boardId = 'board-test-vhistory-1';

  const mockState: BoardState = {
    cards: [
      {
        id: 'c1',
        title: 'User Interview 1',
        body: 'User expressed high interest in dark mode.',
        eyebrow: 'RESEARCH',
        color: 'cream',
        x: 100,
        y: 100,
        width: 220,
        height: 140,
        zIndex: 1,
        rotation: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c2',
        title: 'User Interview 2',
        body: 'Pricing friction during signup.',
        eyebrow: 'FEEDBACK',
        color: 'pink',
        x: 350,
        y: 100,
        width: 220,
        height: 140,
        zIndex: 2,
        rotation: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    shapes: [
      {
        id: 's1',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 600,
        height: 300,
        color: 'slate',
        text: 'User Feedback Container',
        rotation: 0,
        zIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    connectors: [],
    clusters: [
      {
        id: 'cl1',
        label: 'User Research Q3',
        x: 80,
        y: 80,
        width: 500,
        height: 250,
        color: 'slate',
      },
    ],
    textItems: [],
    voteDots: [],
    images: [],
  };

  const snapshot = await versionService.createSnapshot(
    boardId,
    'Baseline Sprint 1',
    mockState,
    { id: 'user-1', name: 'Dhruv Sharma' }
  );

  assert.ok(snapshot.id.startsWith('snap_'));
  assert.equal(snapshot.name, 'Baseline Sprint 1');
  assert.equal(snapshot.boardId, boardId);
  assert.equal(snapshot.createdByName, 'Dhruv Sharma');
  assert.equal(snapshot.itemCount.cards, 2);
  assert.equal(snapshot.itemCount.shapes, 1);
  assert.equal(snapshot.itemCount.clusters, 1);

  // Retrieve snapshots
  const snapshots = await versionService.getSnapshots(boardId);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].id, snapshot.id);
  assert.equal(snapshots[0].name, 'Baseline Sprint 1');
});

test('versionService.restoreSnapshot performs safe restore with automatic backup creation', async () => {
  storage.clear();
  const boardId = 'board-test-vhistory-2';

  const v1State: BoardState = {
    cards: [
      {
        id: 'c1',
        title: 'Sprint 1 Idea',
        body: 'Initial concept',
        eyebrow: 'IDEA',
        color: 'yellow',
        x: 10,
        y: 10,
        width: 200,
        height: 120,
        zIndex: 1,
        rotation: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    shapes: [],
    connectors: [],
    clusters: [],
    textItems: [],
    voteDots: [],
    images: [],
  };

  const v1Snapshot = await versionService.createSnapshot(
    boardId,
    'v1.0 Milestone',
    v1State,
    { id: 'user-1', name: 'Dhruv' }
  );

  const currentState: BoardState = {
    cards: [
      {
        id: 'c2',
        title: 'Current Draft Work',
        body: 'Work in progress that should not be accidentally destroyed',
        eyebrow: 'WIP',
        color: 'blue',
        x: 50,
        y: 50,
        width: 200,
        height: 120,
        zIndex: 1,
        rotation: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    shapes: [],
    connectors: [],
    clusters: [],
    textItems: [],
    voteDots: [],
    images: [],
  };

  // Restore v1.0 Milestone
  const restored = await versionService.restoreSnapshot(
    boardId,
    v1Snapshot.id,
    currentState,
    { id: 'user-1', name: 'Dhruv' }
  );

  assert.ok(restored);
  assert.equal(restored.cards.length, 1);
  assert.equal(restored.cards[0].id, 'c1');
  assert.equal(restored.cards[0].title, 'Sprint 1 Idea');

  // Verify that an automatic backup was recorded in snapshots
  const snapshots = await versionService.getSnapshots(boardId);
  assert.equal(snapshots.length, 2);
  const backup = snapshots.find(s => s.name.includes('Backup before restoring'));
  assert.ok(backup, 'An automatic backup snapshot must be created before restoring');
  assert.equal(backup.itemCount.cards, 1);
  assert.equal(backup.state.cards[0].id, 'c2');
});

test('versionService.deleteSnapshot deletes snapshot accurately', async () => {
  storage.clear();
  const boardId = 'board-test-vhistory-3';

  const emptyState: BoardState = {
    cards: [],
    shapes: [],
    connectors: [],
    clusters: [],
    textItems: [],
    voteDots: [],
    images: [],
  };

  const s1 = await versionService.createSnapshot(boardId, 'Snap 1', emptyState);
  const s2 = await versionService.createSnapshot(boardId, 'Snap 2', emptyState);

  let list = await versionService.getSnapshots(boardId);
  assert.equal(list.length, 2);

  await versionService.deleteSnapshot(boardId, s1.id);
  list = await versionService.getSnapshots(boardId);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, s2.id);
});
