import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import { SoundEffects } from '../utils/soundEffects';
import { recalculateClusters } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'setSelectedIds' | 'toggleSelection' | 'clearSelection' | 'deleteSelected' | 'moveMultipleItems' | 'setActiveTool' | 'setViewport' | 'zoomIn' | 'zoomOut' | 'zoomToFit' | 'resetView' | 'setEditingCardId' | 'setEditingTextId' | 'setViewingCardId' | 'setConnectingFromId'>;

export const createInteractionActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Selection & Multi-drag ───────────────────────────────────────
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelection: (id) => {
    set(state => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter(s => s !== id)
        : [...state.selectedIds, id],
    }));
  },

  clearSelection: () => set({
    selectedIds: [],
    editingCardId: null,
    editingTextId: null,
    editingShapeId: null,
    editingConnectorId: null,
    editingClusterId: null,
  }),

  deleteSelected: () => {
    const { selectedIds, cards, shapes, connectors, clusters, textItems, voteDots, images } = get();
    if (selectedIds.length === 0) return;

    const clusterInSelection = clusters.find(c => selectedIds.includes(c.id));
    if (clusterInSelection && selectedIds.length === 1) {
      get().openConfirmDeleteCluster(clusterInSelection.id);
      return;
    }

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }
    const cardIds = new Set(selectedIds.filter(id => cards.some(c => c.id === id)));
    const shapeIds = new Set(selectedIds.filter(id => shapes.some(s => s.id === id)));
    const connectorIds = new Set(selectedIds.filter(id => connectors.some(c => c.id === id)));
    const clusterIds = new Set(selectedIds.filter(id => clusters.some(c => c.id === id)));
    const textIds = new Set(selectedIds.filter(id => textItems.some(t => t.id === id)));
    const voteIds = new Set(selectedIds.filter(id => voteDots.some(d => d.id === id)));
    const imageIds = new Set(selectedIds.filter(id => images.some(image => image.id === id)));
    const removedItemIds = new Set([...cardIds, ...shapeIds]);

    set(state => {
      const nextCards = state.cards.filter(c => !cardIds.has(c.id));
      const nextShapes = state.shapes.filter(s => !shapeIds.has(s.id));
      const nextTextItems = state.textItems.filter(t => !textIds.has(t.id));
      const nextVoteDots = state.voteDots.filter(d => !voteIds.has(d.id));
      const nextImages = state.images.filter(image => !imageIds.has(image.id));
      const remainingClusters = state.clusters.filter(c => !clusterIds.has(c.id));
      const nextClusters = recalculateClusters(remainingClusters, nextCards, nextShapes);

      return {
        cards: nextCards,
        shapes: nextShapes,
        connectors: state.connectors.filter(
          c =>
            !connectorIds.has(c.id) &&
            (c.fromCardId == null || !removedItemIds.has(c.fromCardId)) &&
            (c.toCardId == null || !removedItemIds.has(c.toCardId))
        ),
        clusters: nextClusters,
        textItems: nextTextItems,
        voteDots: nextVoteDots,
        images: nextImages,
        selectedIds: [],
        editingCardId: null,
        editingShapeId: null,
        editingConnectorId: null,
        editingClusterId: null,
      };
    });
  },

  moveMultipleItems: (dx, dy, itemIds) => {
    if (itemIds.length === 0 || (dx === 0 && dy === 0)) return;
    const idSet = new Set(itemIds);

    const { clusters, cards, shapes } = get();
    const clustersInMove = clusters.filter(cl => idSet.has(cl.id));
    const autoMovedCardIds = new Set<string>();
    const autoMovedShapeIds = new Set<string>();

    clustersInMove.forEach(cl => {
      cards.forEach(c => {
        if (c.clusterId === cl.id || (
          c.x >= cl.x - 5 && c.x + c.width <= cl.x + cl.width + 5 &&
          c.y >= cl.y - 5 && c.y + c.height <= cl.y + cl.height + 5
        )) {
          autoMovedCardIds.add(c.id);
        }
      });
      shapes.forEach(s => {
        if (s.clusterId === cl.id || (
          s.x >= cl.x - 5 && s.x + s.width <= cl.x + cl.width + 5 &&
          s.y >= cl.y - 5 && s.y + s.height <= cl.y + cl.height + 5
        )) {
          autoMovedShapeIds.add(s.id);
        }
      });
    });

    set(state => ({
      cards: state.cards.map(c => (idSet.has(c.id) || autoMovedCardIds.has(c.id)) ? { ...c, x: c.x + dx, y: c.y + dy, updatedAt: new Date().toISOString() } : c),
      shapes: state.shapes.map(s => (idSet.has(s.id) || autoMovedShapeIds.has(s.id)) ? { ...s, x: s.x + dx, y: s.y + dy, updatedAt: new Date().toISOString() } : s),
      clusters: state.clusters.map(cl => idSet.has(cl.id) ? { ...cl, x: cl.x + dx, y: cl.y + dy } : cl),
      textItems: state.textItems.map(t => idSet.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t),
      voteDots: state.voteDots.map(d => idSet.has(d.id) ? { ...d, x: d.x + dx, y: d.y + dy } : d),
      images: state.images.map(image => idSet.has(image.id) ? { ...image, x: image.x + dx, y: image.y + dy } : image),
    }));
  },

  // ── Tool ────────────────────────────────────────────────────────
  setActiveTool: (tool) => set({ activeTool: tool, connectingFromId: null }),

  // ── Viewport ────────────────────────────────────────────────────
  setViewport: (viewport) =>
    set(state => ({ viewport: { ...state.viewport, ...viewport } })),

  zoomIn: () =>
    set(state => ({
      viewport: {
        ...state.viewport,
        scale: Math.min(state.viewport.scale * 1.2, 4),
      },
    })),

  zoomOut: () =>
    set(state => ({
      viewport: {
        ...state.viewport,
        scale: Math.max(state.viewport.scale / 1.2, 0.1),
      },
    })),

  zoomToFit: () => {
    const { cards, shapes, clusters, textItems, voteDots, images } = get();
    if (cards.length === 0 && shapes.length === 0 && clusters.length === 0 && textItems.length === 0 && voteDots.length === 0 && images.length === 0) {
      set({ viewport: { x: 0, y: 0, scale: 1 } });
      return;
    }

    const allItems = [
      ...cards.map(c => ({ x: c.x, y: c.y, w: c.width, h: c.height })),
      ...shapes.map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height })),
      ...clusters.map(c => ({ x: c.x, y: c.y, w: c.width, h: c.height })),
      ...textItems.map(t => ({ x: t.x, y: t.y, w: t.width, h: t.fontSize * 2 })),
      ...voteDots.map(d => ({ x: d.x - 12, y: d.y - 12, w: 24, h: 24 })),
      ...images.map(image => ({ x: image.x, y: image.y, w: image.width, h: image.height })),
    ];

    const minX = Math.min(...allItems.map(i => i.x)) - 60;
    const minY = Math.min(...allItems.map(i => i.y)) - 60;
    const maxX = Math.max(...allItems.map(i => i.x + i.w)) + 60;
    const maxY = Math.max(...allItems.map(i => i.y + i.h)) + 60;

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const stageW = window.innerWidth;
    const stageH = window.innerHeight;

    const scale = Math.min(stageW / contentW, stageH / contentH, 2);
    const x = (stageW - contentW * scale) / 2 - minX * scale;
    const y = (stageH - contentH * scale) / 2 - minY * scale;

    set({ viewport: { x, y, scale } });
  },

  resetView: () => set({ viewport: { x: 0, y: 0, scale: 1 } }),

  // ── Editing ─────────────────────────────────────────────────────
  setEditingCardId: (id) => set({ editingCardId: id, viewingCardId: null, editingTextId: null, editingShapeId: null, editingClusterId: null }),
  setEditingTextId: (id) => set({ editingTextId: id, editingCardId: null, editingShapeId: null, editingClusterId: null }),
  setViewingCardId: (id) => set({ viewingCardId: id }),
  setConnectingFromId: (id) => set({ connectingFromId: id }),

});
