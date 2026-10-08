import type { StateCreator } from 'zustand';
import type { BoardStore } from './boardStoreTypes';
import { v4 as uuidv4 } from 'uuid';
import { SoundEffects } from '../utils/soundEffects';
import { getSmartAnchor, pointBox } from '../utils/connectorGeometry';

type Actions = Pick<BoardStore, 'addConnector' | 'updateConnector' | 'deleteConnector' | 'unlinkCard' | 'detachConnectorEndpoint' | 'updateConnectorEndpointPoint' | 'setEditingConnectorId'>;

export const createConnectorActions: StateCreator<BoardStore, [], [], Actions> = (set, get) => ({
  // ── Connector Actions ───────────────────────────────────────────
  addConnector: (fromCardId, toCardId, color = 'red', style = 'solid', label?: string) => {
    if (fromCardId === toCardId) return '';

    const existing = get().connectors.find(
      c =>
        (c.fromCardId === fromCardId && c.toCardId === toCardId) ||
        (c.fromCardId === toCardId && c.toCardId === fromCardId)
    );
    if (existing) return existing.id;

    const id = uuidv4();
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.stringSnap();
    }
    set(state => ({
      connectors: [...state.connectors, { id, fromCardId, toCardId, color, style, label }],
    }));
    return id;
  },

  updateConnector: (id, updates) => {
    get().pushHistory();
    set(state => ({
      connectors: state.connectors.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  deleteConnector: (id) => {
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }
    set(state => ({
      connectors: state.connectors.filter(c => c.id !== id),
      selectedIds: state.selectedIds.filter(s => s !== id),
      editingConnectorId: state.editingConnectorId === id ? null : state.editingConnectorId,
    }));
  },

  unlinkCard: (cardId) => {
    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.deleteItem();
    }
    set(state => ({
      connectors: state.connectors.filter(
        c => c.fromCardId !== cardId && c.toCardId !== cardId
      ),
    }));
  },

  detachConnectorEndpoint: (id, end) => {
    const { connectors, cards, shapes } = get();
    const conn = connectors.find(c => c.id === id);
    if (!conn) return;

    const resolveItem = (itemId: string | null) =>
      itemId ? (cards.find(c => c.id === itemId) || shapes.find(s => s.id === itemId)) : null;

    const fromItem = resolveItem(conn.fromCardId);
    const toItem = resolveItem(conn.toCardId);
    const targetItem = end === 'from' ? fromItem : toItem;
    if (!targetItem) return; // already detached

    const otherBox = end === 'from'
      ? (toItem ?? pointBox(conn.toPoint!))
      : (fromItem ?? pointBox(conn.fromPoint!));
    const point = getSmartAnchor(targetItem, otherBox);

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.stringSnap();
    }
    set(state => ({
      connectors: state.connectors.map(c => {
        if (c.id !== id) return c;
        return end === 'from'
          ? { ...c, fromCardId: null, fromPoint: point }
          : { ...c, toCardId: null, toPoint: point };
      }),
    }));
  },

  updateConnectorEndpointPoint: (id, end, point) => {
    get().pushHistory();
    set(state => ({
      connectors: state.connectors.map(c => {
        if (c.id !== id) return c;
        return end === 'from' ? { ...c, fromPoint: point } : { ...c, toPoint: point };
      }),
    }));
  },

  setEditingConnectorId: (id) => set({ editingConnectorId: id }),

});
