import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBoardState } from '../src/utils/boardValidation.ts';

test('supports and normalizes text items cleanly without unwanted backgrounds', () => {
  const textInput = [
    {
      id: 'text-1',
      x: 100,
      y: 150,
      text: 'Affinity Mapping Notes',
      fontSize: 24,
      color: '#2b2420',
      width: 300,
    },
    {
      id: 'text-2',
      x: 450,
      y: 150,
      text: 'Insights and Observations',
      fontSize: 18,
      color: '#a3312b',
      width: 250,
    },
  ];

  const state = normalizeBoardState({
    cards: [],
    shapes: [],
    connectors: [],
    clusters: [],
    textItems: textInput,
  });

  assert.equal(state.textItems.length, 2);
  assert.equal(state.textItems[0].id, 'text-1');
  assert.equal(state.textItems[0].text, 'Affinity Mapping Notes');
  assert.equal(state.textItems[0].fontSize, 24);
  assert.equal(state.textItems[0].color, '#2b2420');

  assert.equal(state.textItems[1].id, 'text-2');
  assert.equal(state.textItems[1].text, 'Insights and Observations');
  assert.equal(state.textItems[1].fontSize, 18);
  assert.equal(state.textItems[1].color, '#a3312b');
});
