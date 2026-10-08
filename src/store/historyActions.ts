import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import { snapshot, MAX_HISTORY } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'pushHistory' | 'undo' | 'redo'>;

export const createHistoryActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── History ─────────────────────────────────────────────────────
  pushHistory: () => {
    const { cards, shapes, connectors, clusters, textItems, voteDots, images, history, historyIndex } = get();
    const entry = snapshot(cards, shapes, connectors, clusters, textItems, voteDots, images);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    set({
      cards: entry.cards.map(c => ({ ...c })),
      shapes: (entry.shapes || []).map(s => ({ ...s })),
      connectors: entry.connectors.map(c => ({ ...c })),
      clusters: entry.clusters.map(c => ({ ...c })),
      textItems: (entry.textItems || []).map(t => ({ ...t })),
      voteDots: (entry.voteDots || []).map(d => ({ ...d })),
      images: (entry.images || []).map(image => ({ ...image })),
      historyIndex: historyIndex - 1,
      selectedIds: [],
      editingCardId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    set({
      cards: entry.cards.map(c => ({ ...c })),
      shapes: (entry.shapes || []).map(s => ({ ...s })),
      connectors: entry.connectors.map(c => ({ ...c })),
      clusters: entry.clusters.map(c => ({ ...c })),
      textItems: (entry.textItems || []).map(t => ({ ...t })),
      voteDots: (entry.voteDots || []).map(d => ({ ...d })),
      images: (entry.images || []).map(image => ({ ...image })),
      historyIndex: historyIndex + 1,
      selectedIds: [],
      editingCardId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },

});
