import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBoardBounds,
  calculateMultiBoardPlacements,
  combineBoardsForImport,
  DEFAULT_BOARD_VERTICAL_GAP,
} from '../src/utils/multiBoardLayout.ts';
import type { BoardState } from '../src/types/board.ts';

const createSampleBoard = (
  idSuffix: string,
  startX = 100,
  startY = 100,
  width = 600,
  height = 400,
): BoardState => ({
  cards: [
    {
      id: `card-1-${idSuffix}`,
      x: startX,
      y: startY,
      width: 220,
      height: 140,
      color: 'yellow',
      title: `Card 1 (${idSuffix})`,
      body: 'Card note',
      eyebrow: 'Idea',
      clusterId: `cluster-1-${idSuffix}`,
      zIndex: 1,
      rotation: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: `card-2-${idSuffix}`,
      x: startX + 300,
      y: startY + 150,
      width: 220,
      height: 140,
      color: 'blue',
      title: `Card 2 (${idSuffix})`,
      body: 'Connected note',
      eyebrow: 'Action',
      zIndex: 2,
      rotation: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  shapes: [
    {
      id: `shape-1-${idSuffix}`,
      type: 'rectangle',
      x: startX + 100,
      y: startY + 250,
      width: 180,
      height: 120,
      color: 'cream',
      rotation: 0,
      zIndex: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  connectors: [
    {
      id: `conn-1-${idSuffix}`,
      fromCardId: `card-1-${idSuffix}`,
      toCardId: `card-2-${idSuffix}`,
      color: 'red',
      style: 'solid',
      label: 'relates to',
    },
  ],
  clusters: [
    {
      id: `cluster-1-${idSuffix}`,
      label: `Group ${idSuffix}`,
      x: startX - 20,
      y: startY - 30,
      width,
      height,
      color: 'slate',
    },
  ],
  textItems: [
    {
      id: `text-1-${idSuffix}`,
      x: startX,
      y: startY - 60,
      text: `Board Title ${idSuffix}`,
      fontSize: 24,
      color: '#2b2420',
      width: 200,
      rotation: 0,
      zIndex: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  voteDots: [
    {
      id: `vote-1-${idSuffix}`,
      x: startX + 50,
      y: startY + 50,
      color: 'red',
      zIndex: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  images: [],
});

test('computes bounding box of a board with cards, shapes, clusters, text and votes', () => {
  const board = createSampleBoard('A', 150, 200);
  const bounds = computeBoardBounds(board);

  assert.equal(bounds.hasItems, true);
  assert.equal(bounds.minX <= 150, true);
  assert.equal(bounds.minY <= 200, true);
  assert.equal(bounds.maxX >= 150 + 300 + 220, true); // contains card-2
  assert.equal(bounds.maxY >= 200 + 250 + 120, true); // contains shape-1
  assert.equal(bounds.width, bounds.maxX - bounds.minX);
  assert.equal(bounds.height, bounds.maxY - bounds.minY);
});

test('handles empty board bounding box gracefully', () => {
  const emptyBoard: BoardState = {
    cards: [],
    shapes: [],
    connectors: [],
    clusters: [],
  };
  const bounds = computeBoardBounds(emptyBoard);

  assert.equal(bounds.hasItems, false);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
});

test('arranges multiple boards vertically with consistent gap without overlapping', () => {
  const board1 = createSampleBoard('1', 100, 100);
  const board2 = createSampleBoard('2', 50, 50);
  const board3 = createSampleBoard('3', 200, 300);

  const GAP = 140;
  const placements = calculateMultiBoardPlacements([board1, board2, board3], { gap: GAP });

  assert.equal(placements.length, 3);

  // Board 1 is at the top
  const p1 = placements[0];
  const p2 = placements[1];
  const p3 = placements[2];

  // Placed bounds must be stacked vertically in order
  assert.ok(p1.placedBounds.minY < p2.placedBounds.minY);
  assert.ok(p2.placedBounds.minY < p3.placedBounds.minY);

  // Consistent gap between adjacent boards: top of board 2 == bottom of board 1 + gap
  assert.equal(p2.placedBounds.minY, p1.placedBounds.maxY + GAP);
  assert.equal(p3.placedBounds.minY, p2.placedBounds.maxY + GAP);

  // Consistent horizontal alignment
  assert.equal(p1.placedBounds.minX, p2.placedBounds.minX);
  assert.equal(p2.placedBounds.minX, p3.placedBounds.minX);

  // Verify zero overlap across all pairs of boards
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i].placedBounds;
      const b = placements[j].placedBounds;
      const verticalOverlap = a.minY < b.maxY && a.maxY > b.minY;
      assert.equal(verticalOverlap, false, `Board ${i} overlaps vertically with Board ${j}`);
    }
  }
});

test('uses default gap when gap is not specified', () => {
  const board1 = createSampleBoard('1');
  const board2 = createSampleBoard('2');
  const placements = calculateMultiBoardPlacements([board1, board2]);

  assert.equal(
    placements[1].placedBounds.minY,
    placements[0].placedBounds.maxY + DEFAULT_BOARD_VERTICAL_GAP,
  );
});

test('combines boards for import, preserving connectors (threads) and cluster memberships', () => {
  const board1 = createSampleBoard('1');
  const board2 = createSampleBoard('2');

  const combined = combineBoardsForImport([board1, board2], { gap: 100 });

  // 2 cards per board -> 4 cards
  assert.equal(combined.cards.length, 4);
  // 1 shape per board -> 2 shapes
  assert.equal(combined.shapes.length, 2);
  // 1 connector per board -> 2 connectors
  assert.equal(combined.connectors.length, 2);
  // 1 cluster per board -> 2 clusters
  assert.equal(combined.clusters.length, 2);

  // Check unique IDs across all items (no collisions)
  const allCardIds = combined.cards.map(c => c.id);
  assert.equal(new Set(allCardIds).size, 4);

  // Check connector (thread) integrity:
  // For each connector, its fromCardId and toCardId MUST exist in cards/shapes
  const validIds = new Set([...combined.cards.map(c => c.id), ...combined.shapes.map(s => s.id)]);
  for (const conn of combined.connectors) {
    assert.ok(validIds.has(conn.fromCardId), `Connector fromCardId ${conn.fromCardId} not found`);
    assert.ok(validIds.has(conn.toCardId), `Connector toCardId ${conn.toCardId} not found`);
    assert.notEqual(conn.fromCardId, conn.toCardId);
  }

  // Check cluster membership integrity:
  const clusterIds = new Set(combined.clusters.map(cl => cl.id));
  const clusteredCards = combined.cards.filter(c => c.clusterId);
  assert.equal(clusteredCards.length, 2); // 1 card per board was clustered
  for (const card of clusteredCards) {
    assert.ok(clusterIds.has(card.clusterId!), `Card clusterId ${card.clusterId} not found in clusters`);
  }

  // Verify second board cards are shifted vertically below first board
  const board1CardY = combined.cards.slice(0, 2).map(c => c.y);
  const board2CardY = combined.cards.slice(2, 4).map(c => c.y);
  assert.ok(Math.min(...board2CardY) > Math.max(...board1CardY));
});

test('handles importing duplicate boards safely with unique ID remapping', () => {
  // Simulate user selecting the EXACT SAME board file twice
  const originalBoard = createSampleBoard('duplicate');
  const combined = combineBoardsForImport([originalBoard, originalBoard], { gap: 120 });

  assert.equal(combined.cards.length, 4);
  assert.equal(combined.connectors.length, 2);

  // All IDs in the combined board must be unique
  const itemIds = [
    ...combined.cards.map(c => c.id),
    ...combined.shapes.map(s => s.id),
    ...combined.clusters.map(cl => cl.id),
    ...combined.connectors.map(conn => conn.id),
  ];
  assert.equal(new Set(itemIds).size, itemIds.length);
});

test('preserves single board import as-is when single board provided', () => {
  const board = createSampleBoard('single', 250, 350);
  const result = combineBoardsForImport([board]);

  assert.equal(result.cards.length, board.cards.length);
  assert.equal(result.cards[0].id, board.cards[0].id);
  assert.equal(result.cards[0].x, 250);
  assert.equal(result.cards[0].y, 350);
});
