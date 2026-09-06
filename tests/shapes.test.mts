import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBoardState } from '../src/utils/boardValidation.ts';
import type { ShapeType } from '../src/types/board.ts';

test('supports and normalizes all shape types', () => {
  const supportedTypes: ShapeType[] = ['rectangle', 'circle', 'triangle', 'diamond', 'star', 'hexagon'];

  const shapesInput = supportedTypes.map((type, idx) => ({
    id: `shape-${idx + 1}`,
    type,
    x: idx * 100,
    y: idx * 50,
    width: 140,
    height: 120,
    color: 'cream',
    text: `Shape ${type}`,
  }));

  const state = normalizeBoardState({
    cards: [],
    shapes: shapesInput,
    connectors: [
      { id: 'conn-1', fromCardId: 'shape-1', toCardId: 'shape-2', color: 'red' },
    ],
    clusters: [],
  });

  assert.equal(state.shapes.length, supportedTypes.length);
  supportedTypes.forEach((type, idx) => {
    assert.equal(state.shapes[idx].type, type);
    assert.equal(state.shapes[idx].text, `Shape ${type}`);
    assert.equal(state.shapes[idx].width, 140);
    assert.equal(state.shapes[idx].height, 120);
  });

  // Verify connectors linking shapes remain intact
  assert.equal(state.connectors.length, 1);
  assert.equal(state.connectors[0].fromCardId, 'shape-1');
  assert.equal(state.connectors[0].toCardId, 'shape-2');
});
