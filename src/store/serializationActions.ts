import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import type { Card, Shape, Connector, Cluster } from '../types/board';
import { v4 as uuidv4 } from 'uuid';
import { SoundEffects } from '../utils/soundEffects';
import { normalizeBoardState } from '../utils/boardValidation';
import { combineBoardsForImport } from '../utils/multiBoardLayout';
import { recalculateClusters, getMaxZIndex } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'exportToJSON' | 'importFromJSON' | 'importMultipleBoards' | 'loadTemplate' | 'applyRemoteBoardUpdate' | 'clearBoard'>;

export const createSerializationActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Serialization ───────────────────────────────────────────────
  exportToJSON: () => {
    const { cards, shapes, connectors, clusters, textItems, voteDots, images } = get();
    return { cards, shapes, connectors, clusters, textItems, voteDots, images };
  },

  importFromJSON: (state) => {
    get().pushHistory();
    const safeState = normalizeBoardState(state);
    const rawClusters = safeState.clusters || [];
    const rawCards = safeState.cards || [];
    const rawShapes = safeState.shapes || [];

    const cardsWithClusterId = rawCards.map(card => {
      if (card.clusterId) return card;
      const containing = rawClusters.find(
        cl => card.x >= cl.x - 20 && card.x + card.width <= cl.x + cl.width + 20 &&
          card.y >= cl.y - 20 && card.y + card.height <= cl.y + cl.height + 20
      );
      return containing ? { ...card, clusterId: containing.id } : card;
    });

    const shapesWithClusterId = rawShapes.map(shape => {
      if (shape.clusterId) return shape;
      const containing = rawClusters.find(
        cl => shape.x >= cl.x - 20 && shape.x + shape.width <= cl.x + cl.width + 20 &&
          shape.y >= cl.y - 20 && shape.y + shape.height <= cl.y + cl.height + 20
      );
      return containing ? { ...shape, clusterId: containing.id } : shape;
    });

    const adjustedClusters = recalculateClusters(rawClusters, cardsWithClusterId, shapesWithClusterId);

    const validItemIds = new Set([...cardsWithClusterId, ...shapesWithClusterId].map(item => item.id));
    set({
      cards: cardsWithClusterId,
      shapes: shapesWithClusterId,
      connectors: safeState.connectors.filter(connector =>
        (connector.fromCardId === null || validItemIds.has(connector.fromCardId)) &&
        (connector.toCardId === null || validItemIds.has(connector.toCardId))
      ),
      clusters: adjustedClusters,
      textItems: safeState.textItems || [],
      voteDots: safeState.voteDots || [],
      images: safeState.images || [],
      selectedIds: [],
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },

  importMultipleBoards: (boards, gap) => {
    if (!boards.length) return;
    if (boards.length === 1) {
      get().importFromJSON(boards[0]);
      return;
    }
    get().pushHistory();
    const combinedState = combineBoardsForImport(boards, { gap });
    const rawClusters = combinedState.clusters || [];
    const rawCards = combinedState.cards || [];
    const rawShapes = combinedState.shapes || [];

    const cardsWithClusterId = rawCards.map(card => {
      if (card.clusterId) return card;
      const containing = rawClusters.find(
        cl => card.x >= cl.x - 20 && card.x + card.width <= cl.x + cl.width + 20 &&
          card.y >= cl.y - 20 && card.y + card.height <= cl.y + cl.height + 20
      );
      return containing ? { ...card, clusterId: containing.id } : card;
    });

    const shapesWithClusterId = rawShapes.map(shape => {
      if (shape.clusterId) return shape;
      const containing = rawClusters.find(
        cl => shape.x >= cl.x - 20 && shape.x + shape.width <= cl.x + cl.width + 20 &&
          shape.y >= cl.y - 20 && shape.y + shape.height <= cl.y + cl.height + 20
      );
      return containing ? { ...shape, clusterId: containing.id } : shape;
    });

    const adjustedClusters = recalculateClusters(rawClusters, cardsWithClusterId, shapesWithClusterId);
    const validItemIds = new Set([...cardsWithClusterId, ...shapesWithClusterId].map(item => item.id));

    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    set({
      cards: cardsWithClusterId,
      shapes: shapesWithClusterId,
      connectors: combinedState.connectors.filter(connector =>
        (connector.fromCardId === null || validItemIds.has(connector.fromCardId)) &&
        (connector.toCardId === null || validItemIds.has(connector.toCardId))
      ),
      clusters: adjustedClusters,
      textItems: combinedState.textItems || [],
      voteDots: combinedState.voteDots || [],
      images: combinedState.images || [],
      selectedIds: [],
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },

  loadTemplate: (templateState, mode = 'append') => {
    const { cards: existingCards, shapes: existingShapes, connectors: existingConnectors, clusters: existingClusters } = get();

    if (mode === 'replace' || (existingCards.length === 0 && existingShapes.length === 0 && existingClusters.length === 0)) {
      get().importFromJSON(templateState);
      return;
    }

    get().pushHistory();

    const existingBounds = [
      ...existingCards.map(c => ({ x: c.x, y: c.y, w: c.width, h: c.height })),
      ...existingShapes.map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height })),
      ...existingClusters.map(cl => ({ x: cl.x, y: cl.y, w: cl.width, h: cl.height })),
    ];

    const currentMaxX = Math.max(...existingBounds.map(b => b.x + b.w));
    const currentMinY = Math.min(...existingBounds.map(b => b.y));

    const templateItems = [
      ...(templateState.cards || []).map(c => ({ x: c.x, y: c.y, w: c.width, h: c.height })),
      ...(templateState.shapes || []).map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height })),
      ...(templateState.clusters || []).map(cl => ({ x: cl.x, y: cl.y, w: cl.width, h: cl.height })),
    ];

    const templateMinX = templateItems.length > 0 ? Math.min(...templateItems.map(b => b.x)) : 0;
    const templateMinY = templateItems.length > 0 ? Math.min(...templateItems.map(b => b.y)) : 0;

    const SPACING = 140;
    const offsetX = currentMaxX + SPACING - templateMinX;
    const offsetY = currentMinY - templateMinY;

    const idMap = new Map<string, string>();

    const rawClusters = templateState.clusters || [];
    const newClusters: Cluster[] = rawClusters.map(cl => {
      const newId = uuidv4();
      idMap.set(cl.id, newId);
      return {
        ...cl,
        id: newId,
        x: cl.x + offsetX,
        y: cl.y + offsetY,
      };
    });

    const rawCards = templateState.cards || [];
    const newCards: Card[] = rawCards.map(c => {
      const newId = uuidv4();
      idMap.set(c.id, newId);
      const newClusterId = c.clusterId ? idMap.get(c.clusterId) || c.clusterId : undefined;
      return {
        ...c,
        id: newId,
        x: c.x + offsetX,
        y: c.y + offsetY,
        clusterId: newClusterId,
        zIndex: getMaxZIndex(existingCards, existingShapes) + (c.zIndex || 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const rawShapes = templateState.shapes || [];
    const newShapes: Shape[] = rawShapes.map(s => {
      const newId = uuidv4();
      idMap.set(s.id, newId);
      const newClusterId = s.clusterId ? idMap.get(s.clusterId) || s.clusterId : undefined;
      return {
        ...s,
        id: newId,
        x: s.x + offsetX,
        y: s.y + offsetY,
        clusterId: newClusterId,
        zIndex: getMaxZIndex(existingCards, existingShapes) + (s.zIndex || 1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    const rawConnectors = templateState.connectors || [];
    const newConnectors: Connector[] = rawConnectors.map(conn => {
      const newId = uuidv4();
      return {
        ...conn,
        id: newId,
        fromCardId: conn.fromCardId ? (idMap.get(conn.fromCardId) || conn.fromCardId) : null,
        toCardId: conn.toCardId ? (idMap.get(conn.toCardId) || conn.toCardId) : null,
      };
    });

    const allCombinedCards = [...existingCards, ...newCards];
    const allCombinedShapes = [...existingShapes, ...newShapes];
    const allCombinedClusters = [...existingClusters, ...newClusters];
    const allCombinedConnectors = [...existingConnectors, ...newConnectors];

    const adjustedClusters = recalculateClusters(allCombinedClusters, allCombinedCards, allCombinedShapes);

    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    set({
      cards: allCombinedCards,
      shapes: allCombinedShapes,
      clusters: adjustedClusters,
      connectors: allCombinedConnectors,
      selectedIds: newClusters.length > 0 ? newClusters.map(cl => cl.id) : newCards.map(c => c.id),
      editingCardId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },

  applyRemoteBoardUpdate: (remoteState) => {
    const safeState = normalizeBoardState(remoteState);
    const {
      editingCardId,
      editingShapeId,
      editingTextId,
      editingClusterId,
      editingConnectorId,
      cards: localCards,
      shapes: localShapes,
      textItems: localTextItems,
      clusters: localClusters,
      connectors: localConnectors,
    } = get();

    // Preserve local elements currently being edited so remote sync doesn't stomp active editing
    const updatedCards = safeState.cards.map((c) => {
      if (editingCardId === c.id) {
        const local = localCards.find((lc) => lc.id === c.id);
        return local || c;
      }
      return c;
    });

    const updatedShapes = safeState.shapes.map((s) => {
      if (editingShapeId === s.id) {
        const local = localShapes.find((ls) => ls.id === s.id);
        return local || s;
      }
      return s;
    });

    const updatedTextItems = (safeState.textItems || []).map((t) => {
      if (editingTextId === t.id) {
        const local = localTextItems.find((lt) => lt.id === t.id);
        return local || t;
      }
      return t;
    });

    const updatedClusters = (safeState.clusters || []).map((cl) => {
      if (editingClusterId === cl.id) {
        const local = localClusters.find((lcl) => lcl.id === cl.id);
        return local || cl;
      }
      return cl;
    });

    const updatedConnectors = (safeState.connectors || []).map((conn) => {
      if (editingConnectorId === conn.id) {
        const local = localConnectors.find((lc) => lc.id === conn.id);
        return local || conn;
      }
      return conn;
    });

    set({
      cards: updatedCards,
      shapes: updatedShapes,
      textItems: updatedTextItems,
      clusters: updatedClusters,
      connectors: updatedConnectors,
      voteDots: safeState.voteDots || [],
      images: safeState.images || [],
    });
  },

  clearBoard: () => {
    get().pushHistory();
    set({
      cards: [],
      shapes: [],
      connectors: [],
      clusters: [],
      textItems: [],
      voteDots: [],
      images: [],
      selectedIds: [],
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
      confirmDeleteCluster: null,
    });
  },
});
