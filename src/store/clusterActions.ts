import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import type { Card, Shape, Connector, Cluster } from '../types/board';
import { v4 as uuidv4 } from 'uuid';
import { SoundEffects } from '../utils/soundEffects';
import { recalculateClusters } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'addCluster' | 'updateCluster' | 'deleteCluster' | 'groupSelected' | 'ungroup' | 'resizeCluster' | 'duplicateCluster' | 'deleteClusterWithContents' | 'moveCluster' | 'bringClusterToFront' | 'setEditingClusterId' | 'openConfirmDeleteCluster' | 'closeConfirmDeleteCluster'>;

export const createClusterActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Cluster Actions ─────────────────────────────────────────────
  addCluster: (x, y, width = 320, height = 220, label = 'New Group', color = 'slate') => {
    const id = uuidv4();
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    const adoptedCards = get().cards.filter(
      c => c.x >= x - 10 && c.x + c.width <= x + width + 10 &&
        c.y >= y - 10 && c.y + c.height <= y + height + 10
    );
    const adoptedShapes = get().shapes.filter(
      s => s.x >= x - 10 && s.x + s.width <= x + width + 10 &&
        s.y >= y - 10 && s.y + s.height <= y + height + 10
    );

    const adoptedCardIds = new Set(adoptedCards.map(c => c.id));
    const adoptedShapeIds = new Set(adoptedShapes.map(s => s.id));

    set(state => {
      const updatedCards = state.cards.map(c => adoptedCardIds.has(c.id) ? { ...c, clusterId: id } : c);
      const updatedShapes = state.shapes.map(s => adoptedShapeIds.has(s.id) ? { ...s, clusterId: id } : s);
      const newCluster: Cluster = { id, label, x, y, width, height, color };
      const nextClusters = recalculateClusters([...state.clusters, newCluster], updatedCards, updatedShapes);

      return {
        clusters: nextClusters,
        cards: updatedCards,
        shapes: updatedShapes,
        selectedIds: [id],
      };
    });
    return id;
  },

  updateCluster: (id, updates) => {
    get().pushHistory();
    set(state => ({
      clusters: state.clusters.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  deleteCluster: (id) => {
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }
    set(state => ({
      clusters: state.clusters.filter(c => c.id !== id),
      cards: state.cards.map(c => c.clusterId === id ? { ...c, clusterId: undefined } : c),
      shapes: state.shapes.map(s => s.clusterId === id ? { ...s, clusterId: undefined } : s),
      selectedIds: state.selectedIds.filter(s => s !== id),
      editingClusterId: state.editingClusterId === id ? null : state.editingClusterId,
      confirmDeleteCluster: null,
    }));
  },

  groupSelected: () => {
    const { selectedIds, cards, shapes, clusters } = get();
    const selectedCards = cards.filter(c => selectedIds.includes(c.id));
    const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));
    const selectedClusters = clusters.filter(cl => selectedIds.includes(cl.id));

    const allItems: { x: number; y: number; width: number; height: number }[] = [
      ...selectedCards.map(c => ({ x: c.x, y: c.y, width: c.width, height: c.height })),
      ...selectedShapes.map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height })),
      ...selectedClusters.map(cl => ({ x: cl.x, y: cl.y, width: cl.width, height: cl.height })),
    ];

    if (allItems.length === 0) return null;

    const PADDING_X = 28;
    const PADDING_TOP = 44;
    const PADDING_BOTTOM = 28;

    const minX = Math.min(...allItems.map(i => i.x)) - PADDING_X;
    const minY = Math.min(...allItems.map(i => i.y)) - PADDING_TOP;
    const maxX = Math.max(...allItems.map(i => i.x + i.width)) + PADDING_X;
    const maxY = Math.max(...allItems.map(i => i.y + i.height)) + PADDING_BOTTOM;

    const width = Math.max(280, maxX - minX);
    const height = Math.max(180, maxY - minY);

    const id = uuidv4();
    const nextGroupNum = clusters.length + 1;
    const label = `Group ${nextGroupNum}`;

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    const cardIdSet = new Set(selectedCards.map(c => c.id));
    const shapeIdSet = new Set(selectedShapes.map(s => s.id));

    set(state => ({
      clusters: [
        ...state.clusters,
        { id, label, x: minX, y: minY, width, height, color: 'slate' },
      ],
      cards: state.cards.map(c => cardIdSet.has(c.id) ? { ...c, clusterId: id } : c),
      shapes: state.shapes.map(s => shapeIdSet.has(s.id) ? { ...s, clusterId: id } : s),
      selectedIds: [id],
      activeTool: 'select',
    }));

    return id;
  },

  ungroup: (id) => {
    const { clusters, cards, shapes } = get();
    const target = clusters.find(c => c.id === id);
    if (!target) return;

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }

    const memberCardIds = cards
      .filter(c => c.clusterId === id || (
        c.x >= target.x && c.x + c.width <= target.x + target.width &&
        c.y >= target.y && c.y + c.height <= target.y + target.height
      ))
      .map(c => c.id);

    const memberShapeIds = shapes
      .filter(s => s.clusterId === id || (
        s.x >= target.x && s.x + s.width <= target.x + target.width &&
        s.y >= target.y && s.y + s.height <= target.y + target.height
      ))
      .map(s => s.id);

    set(state => ({
      clusters: state.clusters.filter(c => c.id !== id),
      cards: state.cards.map(c => c.clusterId === id ? { ...c, clusterId: undefined } : c),
      shapes: state.shapes.map(s => s.clusterId === id ? { ...s, clusterId: undefined } : s),
      selectedIds: [...memberCardIds, ...memberShapeIds],
      editingClusterId: state.editingClusterId === id ? null : state.editingClusterId,
      confirmDeleteCluster: null,
    }));
  },

  resizeCluster: (id, width, height, x, y) => {
    get().pushHistory();
    set(state => ({
      clusters: state.clusters.map(c =>
        c.id === id
          ? {
            ...c,
            width: Math.max(100, Math.round(width)),
            height: Math.max(80, Math.round(height)),
            ...(x !== undefined ? { x: Math.round(x) } : {}),
            ...(y !== undefined ? { y: Math.round(y) } : {}),
          }
          : c
      ),
    }));
  },

  duplicateCluster: (clusterId) => {
    const { clusters, cards, shapes, connectors } = get();
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const containedCards = cards.filter(
      c => c.clusterId === cluster.id || (
        c.x >= cluster.x - 10 && c.x + c.width <= cluster.x + cluster.width + 10 &&
        c.y >= cluster.y - 10 && c.y + c.height <= cluster.y + cluster.height + 10
      )
    );
    const containedShapes = shapes.filter(
      s => s.clusterId === cluster.id || (
        s.x >= cluster.x - 10 && s.x + s.width <= cluster.x + cluster.width + 10 &&
        s.y >= cluster.y - 10 && s.y + s.height <= cluster.y + cluster.height + 10
      )
    );

    const OFFSET = 40;
    const newClusterId = uuidv4();
    const idMap = new Map<string, string>();

    const newCards: Card[] = containedCards.map(c => {
      const newId = uuidv4();
      idMap.set(c.id, newId);
      return {
        ...c,
        id: newId,
        clusterId: newClusterId,
        x: c.x + OFFSET,
        y: c.y + OFFSET,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const newShapes: Shape[] = containedShapes.map(s => {
      const newId = uuidv4();
      idMap.set(s.id, newId);
      return {
        ...s,
        id: newId,
        clusterId: newClusterId,
        x: s.x + OFFSET,
        y: s.y + OFFSET,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const containedItemIds = new Set([...containedCards.map(c => c.id), ...containedShapes.map(s => s.id)]);
    const internalConnectors = connectors.filter(
      (conn): conn is Connector & { fromCardId: string; toCardId: string } =>
        conn.fromCardId !== null && conn.toCardId !== null &&
        containedItemIds.has(conn.fromCardId) && containedItemIds.has(conn.toCardId)
    );

    const newConnectors: Connector[] = internalConnectors.map(conn => ({
      ...conn,
      id: uuidv4(),
      fromCardId: idMap.get(conn.fromCardId) || conn.fromCardId,
      toCardId: idMap.get(conn.toCardId) || conn.toCardId,
    }));

    const newCluster: Cluster = {
      ...cluster,
      id: newClusterId,
      label: `${cluster.label} (Copy)`,
      x: cluster.x + OFFSET,
      y: cluster.y + OFFSET,
    };

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    set(state => ({
      clusters: [...state.clusters, newCluster],
      cards: [...state.cards, ...newCards],
      shapes: [...state.shapes, ...newShapes],
      connectors: [...state.connectors, ...newConnectors],
      selectedIds: [newClusterId],
    }));

    return newClusterId;
  },

  deleteClusterWithContents: (clusterId) => {
    const { clusters, cards, shapes } = get();
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    const containedCards = cards.filter(
      c => c.clusterId === cluster.id || (
        c.x >= cluster.x - 10 && c.x + c.width <= cluster.x + cluster.width + 10 &&
        c.y >= cluster.y - 10 && c.y + c.height <= cluster.y + cluster.height + 10
      )
    );
    const containedShapes = shapes.filter(
      s => s.clusterId === cluster.id || (
        s.x >= cluster.x - 10 && s.x + s.width <= cluster.x + cluster.width + 10 &&
        s.y >= cluster.y - 10 && s.y + s.height <= cluster.y + cluster.height + 10
      )
    );

    const cardIds = new Set(containedCards.map(c => c.id));
    const shapeIds = new Set(containedShapes.map(s => s.id));
    const removedItemIds = new Set([...cardIds, ...shapeIds]);

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }

    set(state => ({
      clusters: state.clusters.filter(c => c.id !== clusterId),
      cards: state.cards.filter(c => !cardIds.has(c.id)),
      shapes: state.shapes.filter(s => !shapeIds.has(s.id)),
      connectors: state.connectors.filter(
        c =>
          (c.fromCardId == null || !removedItemIds.has(c.fromCardId)) &&
          (c.toCardId == null || !removedItemIds.has(c.toCardId))
      ),
      selectedIds: state.selectedIds.filter(id => id !== clusterId && !removedItemIds.has(id)),
      editingClusterId: state.editingClusterId === clusterId ? null : state.editingClusterId,
      confirmDeleteCluster: null,
    }));
  },

  moveCluster: (id, x, y) => {
    const { clusters } = get();
    const cl = clusters.find(c => c.id === id);
    if (!cl) return;
    const dx = x - cl.x;
    const dy = y - cl.y;
    if (dx === 0 && dy === 0) return;

    set(state => {
      const currentCl = state.clusters.find(c => c.id === id);
      if (!currentCl) return state;
      return {
        clusters: state.clusters.map(c => c.id === id ? { ...c, x, y } : c),
        cards: state.cards.map(c => {
          if (c.clusterId === id || (
            c.x >= currentCl.x - 5 && c.x + c.width <= currentCl.x + currentCl.width + 5 &&
            c.y >= currentCl.y - 5 && c.y + c.height <= currentCl.y + currentCl.height + 5
          )) {
            return { ...c, x: c.x + dx, y: c.y + dy, updatedAt: new Date().toISOString() };
          }
          return c;
        }),
        shapes: state.shapes.map(s => {
          if (s.clusterId === id || (
            s.x >= currentCl.x - 5 && s.x + s.width <= currentCl.x + currentCl.width + 5 &&
            s.y >= currentCl.y - 5 && s.y + s.height <= currentCl.y + currentCl.height + 5
          )) {
            return { ...s, x: s.x + dx, y: s.y + dy, updatedAt: new Date().toISOString() };
          }
          return s;
        }),
      };
    });
  },

  bringClusterToFront: (id) => {
    const { clusters } = get();
    const target = clusters.find(c => c.id === id);
    if (!target) return;
    set(state => ({
      clusters: [...state.clusters.filter(c => c.id !== id), target],
    }));
  },

  setEditingClusterId: (id) => set({ editingClusterId: id }),

  openConfirmDeleteCluster: (clusterId: string) => {
    const { clusters, cards } = get();
    const cluster = clusters.find(c => c.id === clusterId);
    if (!cluster) return;
    const memberCount = cards.filter(c => c.clusterId === clusterId || (
      c.x >= cluster.x && c.x + c.width <= cluster.x + cluster.width &&
      c.y >= cluster.y && c.y + c.height <= cluster.y + cluster.height
    )).length;

    set({
      confirmDeleteCluster: {
        isOpen: true,
        clusterId,
        clusterLabel: cluster.label || 'Untitled Group',
        cardCount: memberCount,
      },
    });
  },

  closeConfirmDeleteCluster: () => set({ confirmDeleteCluster: null }),

});
