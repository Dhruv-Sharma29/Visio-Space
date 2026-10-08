import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import type { Shape } from '../types/board';
import { v4 as uuidv4 } from 'uuid';
import { getShapeDefinition } from '../components/Shape/shapeRegistry';
import { SoundEffects } from '../utils/soundEffects';
import { recalculateClusters, getMaxZIndex } from './boardStoreHelpers';

type Actions = Pick<BoardStore, 'addShape' | 'updateShape' | 'deleteShape' | 'moveShape' | 'resizeShape' | 'bringShapeToFront' | 'setActiveShapeType' | 'setEditingShapeId'>;

export const createShapeActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Shape Actions ───────────────────────────────────────────────
  addShape: (type, x = 100, y = 100, width, height, color = 'cream', text = '') => {
    const shapeType = type || get().activeShapeType || 'rectangle';
    const def = getShapeDefinition(shapeType);
    const shapeWidth = width || def.defaultWidth;
    const shapeHeight = height || def.defaultHeight;
    const id = uuidv4();
    const now = new Date().toISOString();
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
    }

    const containing = get().clusters.find(
      cl => x >= cl.x - 10 && x + shapeWidth <= cl.x + cl.width + 10 &&
        y >= cl.y - 10 && y + shapeHeight <= cl.y + cl.height + 10
    );

    const newShape: Shape = {
      id,
      type: shapeType,
      x,
      y,
      width: shapeWidth,
      height: shapeHeight,
      color,
      text,
      rotation: 0,
      clusterId: containing ? containing.id : undefined,
      zIndex: getMaxZIndex(get().cards, get().shapes) + 1,
      createdAt: now,
      updatedAt: now,
    };

    set(state => {
      const nextShapes = [...state.shapes, newShape];
      const nextClusters = recalculateClusters(state.clusters, state.cards, nextShapes);
      return {
        shapes: nextShapes,
        clusters: nextClusters,
        editingCardId: null,
        editingShapeId: null,
        selectedIds: [id],
      };
    });
    return id;
  },

  updateShape: (id, updates) => {
    get().pushHistory();
    set(state => {
      const nextShapes = state.shapes.map(s =>
        s.id === id
          ? { ...s, ...updates, updatedAt: new Date().toISOString() }
          : s
      );
      const nextClusters = recalculateClusters(state.clusters, state.cards, nextShapes);
      return {
        shapes: nextShapes,
        clusters: nextClusters,
      };
    });
  },

  deleteShape: (id) => {
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }
    set(state => {
      const nextShapes = state.shapes.filter(s => s.id !== id);
      const nextClusters = recalculateClusters(state.clusters, state.cards, nextShapes);
      return {
        shapes: nextShapes,
        clusters: nextClusters,
        connectors: state.connectors.filter(
          c => c.fromCardId !== id && c.toCardId !== id
        ),
        selectedIds: state.selectedIds.filter(s => s !== id),
        editingShapeId: state.editingShapeId === id ? null : state.editingShapeId,
      };
    });
  },

  moveShape: (id, x, y) => {
    set(state => {
      const targetShape = state.shapes.find(s => s.id === id);
      if (!targetShape) return state;

      let updatedClusterId = targetShape.clusterId;
      const currentContainingCluster = state.clusters.find(
        cl => x >= cl.x - 20 && x + targetShape.width <= cl.x + cl.width + 20 &&
          y >= cl.y - 20 && y + targetShape.height <= cl.y + cl.height + 20
      );
      if (currentContainingCluster) {
        updatedClusterId = currentContainingCluster.id;
      }

      const nextShapes = state.shapes.map(s =>
        s.id === id ? { ...s, x, y, clusterId: updatedClusterId, updatedAt: new Date().toISOString() } : s
      );
      const nextClusters = recalculateClusters(state.clusters, state.cards, nextShapes);
      return {
        shapes: nextShapes,
        clusters: nextClusters,
      };
    });
  },

  resizeShape: (id, width, height, x, y, rotation) => {
    get().pushHistory();
    set(state => {
      const nextShapes = state.shapes.map(s =>
        s.id === id
          ? {
            ...s,
            width: Math.max(20, width),
            height: Math.max(20, height),
            ...(x !== undefined ? { x } : {}),
            ...(y !== undefined ? { y } : {}),
            ...(rotation !== undefined ? { rotation } : {}),
            updatedAt: new Date().toISOString(),
          }
          : s
      );
      const nextClusters = recalculateClusters(state.clusters, state.cards, nextShapes);
      return {
        shapes: nextShapes,
        clusters: nextClusters,
      };
    });
  },

  bringShapeToFront: (id) => {
    set(state => ({
      shapes: state.shapes.map(s =>
        s.id === id
          ? { ...s, zIndex: getMaxZIndex(state.cards, state.shapes) + 1 }
          : s
      ),
    }));
  },

  setActiveShapeType: (type) => set({ activeShapeType: type }),

  setEditingShapeId: (id) => set({ editingShapeId: id }),

});
