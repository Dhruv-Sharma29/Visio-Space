import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'vite';

// Exercise the assembled store, including imports between the action modules.
const temporary = await mkdtemp(resolve('node_modules/.board-store-test-'));
after(() => rm(temporary, { recursive: true, force: true }));
await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: { entry: resolve('src/store/boardStore.ts'), formats: ['cjs'], fileName: () => 'store.cjs' },
    outDir: temporary,
    rolldownOptions: { external: ['react', 'zustand', 'uuid'] },
  },
});
const { useBoardStore } = createRequire(import.meta.url)(join(temporary, 'store.cjs'));
const fresh = () => {
  useBoardStore.setState(useBoardStore.getInitialState(), true);
  useBoardStore.getState().setSoundEnabled(false);
  return useBoardStore.getState();
};

test('content, connectors, clusters and history compose into the same store', () => {
  fresh();
  const card = useBoardStore.getState().addCard(0, 0);
  const shape = useBoardStore.getState().addShape('rectangle', 350, 100);
  const connector = useBoardStore.getState().addConnector(card, shape);
  assert.equal(useBoardStore.getState().connectors[0].id, connector);
  useBoardStore.getState().setSelectedIds([card, shape]);
  const cluster = useBoardStore.getState().groupSelected();
  assert.ok(cluster);
  assert.equal(useBoardStore.getState().cards[0].clusterId, cluster);
  useBoardStore.getState().undo();
  assert.equal(useBoardStore.getState().clusters.length, 0);
  assert.equal(useBoardStore.getState().cards.length, 1);
  assert.equal(useBoardStore.getState().shapes.length, 1);
});

test('serialization and remote updates preserve an actively edited card', () => {
  fresh();
  const id = useBoardStore.getState().addCard(10, 20);
  useBoardStore.getState().updateCard(id, { title: 'local edit' });
  const exported = useBoardStore.getState().exportToJSON();
  useBoardStore.getState().setEditingCardId(id);
  const remote = structuredClone(exported);
  remote.cards[0].title = 'remote edit';
  useBoardStore.getState().applyRemoteBoardUpdate(remote);
  assert.equal(useBoardStore.getState().cards[0].title, 'local edit');
  useBoardStore.getState().setEditingCardId(null);
  useBoardStore.getState().applyRemoteBoardUpdate(remote);
  assert.equal(useBoardStore.getState().cards[0].title, 'remote edit');
  useBoardStore.getState().importFromJSON(exported);
  assert.equal(useBoardStore.getState().cards[0].title, 'local edit');
});
