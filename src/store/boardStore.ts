import { create } from 'zustand';
import type { BoardRole, ToolbarDock } from '../types/board';
import type { BoardStore } from './boardStoreTypes';
export type { ConfirmDeleteModalState } from './boardStoreTypes';
import { createContentActions } from './contentActions';
import { createShapeActions } from './shapeActions';
import { createConnectorActions } from './connectorActions';
import { createClusterActions } from './clusterActions';
import { createInteractionActions } from './interactionActions';
import { createHistoryActions } from './historyActions';
import { createSerializationActions } from './serializationActions';

function getInitialToolbarPosition(): { dock: ToolbarDock; offset: number } {
  if (typeof window === 'undefined') return { dock: 'left', offset: 50 };
  try {
    const saved = JSON.parse(localStorage.getItem('visiospace_toolbar') || '{}');
    if (['left', 'right', 'top', 'bottom'].includes(saved.dock) && Number.isFinite(saved.offset)) {
      return { dock: saved.dock as ToolbarDock, offset: Math.max(10, Math.min(90, saved.offset)) };
    }
  } catch { /* use the responsive default */ }
  return { dock: window.innerHeight <= 700 ? 'bottom' : 'left', offset: 50 };
}

const initialToolbarPosition = getInitialToolbarPosition();

// ─── Store ──────────────────────────────────────────────────────────
export const useBoardStore = create<BoardStore>((set, get, store) => ({
  // Initial state
  cards: [],
  shapes: [],
  connectors: [],
  clusters: [],
  textItems: [],
  voteDots: [],
  images: [],
  selectedIds: [],
  activeTool: 'select',
  activeShapeType: 'rectangle',
  viewport: { x: 0, y: 0, scale: 1 },
  editingCardId: null,
  viewingCardId: null,
  editingTextId: null,
  editingShapeId: null,
  editingConnectorId: null,
  editingClusterId: null,
  confirmDeleteCluster: null,
  connectingFromId: null,
  followingUserId: null,
  setFollowingUserId: (userId: string | null) => set({ followingUserId: userId }),
  currentRole: 'owner',
  setCurrentRole: (role: BoardRole) => set({ currentRole: role }),
  canEdit: () => {
    const role = get().currentRole;
    return role === 'owner' || role === 'editor';
  },
  soundEnabled: typeof window !== 'undefined' ? (localStorage.getItem('visiospace_sound') ?? localStorage.getItem('affinity_sound')) !== 'false' : true,
  toolbarDock: initialToolbarPosition.dock,
  toolbarOffset: initialToolbarPosition.offset,
  history: [],
  historyIndex: -1,

  // ── Sound ───────────────────────────────────────────────────────
  toggleSound: () => {
    const next = !get().soundEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('visiospace_sound', String(next));
    }
    set({ soundEnabled: next });
  },

  setSoundEnabled: (enabled: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('visiospace_sound', String(enabled));
    }
    set({ soundEnabled: enabled });
  },

  setToolbarPosition: (dock, offset) => {
    const safeOffset = Math.max(10, Math.min(90, offset));
    if (typeof window !== 'undefined') localStorage.setItem('visiospace_toolbar', JSON.stringify({ dock, offset: safeOffset }));
    set({ toolbarDock: dock, toolbarOffset: safeOffset });
  },

  ...createContentActions(set, get, store),
  ...createShapeActions(set, get, store),
  ...createConnectorActions(set, get, store),
  ...createClusterActions(set, get, store),
  ...createInteractionActions(set, get, store),
  ...createHistoryActions(set, get, store),
  ...createSerializationActions(set, get, store),
}));
