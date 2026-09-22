import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Card, Shape, Connector, Cluster, Tool, Viewport,
  CardColor, ShapeType, ShapeColor, ConnectorColor, ConnectorStyle, ClusterColor, TextItem, VoteDot, VoteColor,
  BoardState, HistoryEntry, ToolbarDock, ImageItem, BoardRole,
} from '../types/board';
import { getShapeDefinition } from '../components/Shape/shapeRegistry';
import { SoundEffects } from '../utils/soundEffects';
import { normalizeBoardState } from '../utils/boardValidation';
import { getImportLayout } from '../utils/importLayout';
import { combineBoardsForImport } from '../utils/multiBoardLayout';
import { getSmartAnchor, pointBox } from '../utils/connectorGeometry';

// ─── Constants ──────────────────────────────────────────────────────
const MAX_HISTORY = 50;
const DEFAULT_CARD_WIDTH = 220;
const DEFAULT_CARD_HEIGHT = 140;

export interface ConfirmDeleteModalState {
  isOpen: boolean;
  clusterId: string;
  clusterLabel: string;
  cardCount: number;
}

// ─── Dynamic Auto-Resize Helper ────────────────────────────────────
function recalculateClusters(clusters: Cluster[], cards: Card[], shapes: Shape[] = []): Cluster[] {
  return clusters.map(cl => {
    const memberCards = cards.filter(c => c.clusterId === cl.id);
    const memberShapes = shapes.filter(s => s.clusterId === cl.id);
    const memberItems = [
      ...memberCards.map(c => ({ x: c.x, y: c.y, width: c.width, height: c.height })),
      ...memberShapes.map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height })),
    ];

    if (memberItems.length === 0) {
      return cl;
    }

    const PADDING_X = 28;
    const PADDING_TOP = 46;
    const PADDING_BOTTOM = 28;

    const minX = Math.min(...memberItems.map(i => i.x)) - PADDING_X;
    const minY = Math.min(...memberItems.map(i => i.y)) - PADDING_TOP;
    const maxX = Math.max(...memberItems.map(i => i.x + i.width)) + PADDING_X;
    const maxY = Math.max(...memberItems.map(i => i.y + i.height)) + PADDING_BOTTOM;

    return {
      ...cl,
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.max(280, Math.round(maxX - minX)),
      height: Math.max(180, Math.round(maxY - minY)),
    };
  });
}

// ─── Store Interface ────────────────────────────────────────────────
interface BoardStore {
  // State
  cards: Card[];
  shapes: Shape[];
  connectors: Connector[];
  clusters: Cluster[];
  textItems: TextItem[];
  voteDots: VoteDot[];
  images: ImageItem[];
  selectedIds: string[];
  activeTool: Tool;
  activeShapeType: ShapeType;
  viewport: Viewport;
  editingCardId: string | null;
  viewingCardId: string | null;
  editingTextId: string | null;
  editingShapeId: string | null;
  editingConnectorId: string | null;
  editingClusterId: string | null;
  confirmDeleteCluster: ConfirmDeleteModalState | null;
  connectingFromId: string | null;
  soundEnabled: boolean;
  toolbarDock: ToolbarDock;
  toolbarOffset: number;

  // Permissions & Role
  currentRole: BoardRole;
  setCurrentRole: (role: BoardRole) => void;
  canEdit: () => boolean;

  // History
  history: HistoryEntry[];
  historyIndex: number;

  // Sound
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setToolbarPosition: (dock: ToolbarDock, offset: number) => void;

  // Card actions
  addCard: (x: number, y: number, color?: CardColor, clusterId?: string) => string;
  importCards: (cards: Array<Pick<Card, 'title' | 'body' | 'eyebrow' | 'color'>>) => string[];
  addImage: (src: string, name?: string, x?: number, y?: number, width?: number, height?: number, shape?: ShapeType) => string;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  deleteImage: (id: string) => void;
  moveImage: (id: string, x: number, y: number) => void;
  bringImageToFront: (id: string) => void;
  addCardToCluster: (clusterId: string, color?: CardColor) => string;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  moveCard: (id: string, x: number, y: number) => void;
  addTextItem: (x: number, y: number, text?: string) => string;
  updateTextItem: (id: string, updates: Partial<TextItem>) => void;
  deleteTextItem: (id: string) => void;
  moveTextItem: (id: string, x: number, y: number) => void;
  addVoteDot: (x: number, y: number, color?: VoteColor) => string;
  deleteVoteDot: (id: string) => void;
  moveVoteDot: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;

  // Shape actions
  addShape: (type?: ShapeType, x?: number, y?: number, width?: number, height?: number, color?: ShapeColor, text?: string) => string;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  moveShape: (id: string, x: number, y: number) => void;
  resizeShape: (id: string, width: number, height: number, x?: number, y?: number, rotation?: number) => void;
  bringShapeToFront: (id: string) => void;
  setActiveShapeType: (type: ShapeType) => void;
  setEditingShapeId: (id: string | null) => void;

  // Connector actions
  addConnector: (fromCardId: string, toCardId: string, color?: ConnectorColor, style?: ConnectorStyle, label?: string) => string;
  updateConnector: (id: string, updates: Partial<Connector>) => void;
  deleteConnector: (id: string) => void;
  unlinkCard: (cardId: string) => void;
  detachConnectorEndpoint: (id: string, end: 'from' | 'to') => void;
  updateConnectorEndpointPoint: (id: string, end: 'from' | 'to', point: { x: number; y: number }) => void;
  setEditingConnectorId: (id: string | null) => void;

  // Cluster actions
  addCluster: (x: number, y: number, width?: number, height?: number, label?: string, color?: ClusterColor) => string;
  updateCluster: (id: string, updates: Partial<Cluster>) => void;
  deleteCluster: (id: string) => void;
  deleteClusterWithContents: (id: string) => void;
  groupSelected: () => string | null;
  ungroup: (id: string) => void;
  resizeCluster: (id: string, width: number, height: number, x?: number, y?: number) => void;
  duplicateCluster: (clusterId: string) => string | null;
  moveCluster: (id: string, x: number, y: number) => void;
  bringClusterToFront: (id: string) => void;
  setEditingClusterId: (id: string | null) => void;
  openConfirmDeleteCluster: (clusterId: string) => void;
  closeConfirmDeleteCluster: () => void;

  // Selection & Multi-drag
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  moveMultipleItems: (dx: number, dy: number, itemIds: string[]) => void;

  // Tool
  setActiveTool: (tool: Tool) => void;

  // Viewport
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetView: () => void;

  // Editing
  setEditingCardId: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  setViewingCardId: (id: string | null) => void;
  setConnectingFromId: (id: string | null) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Follow / Presence Mode
  followingUserId: string | null;
  setFollowingUserId: (userId: string | null) => void;

  // Realtime Sync
  applyRemoteBoardUpdate: (state: BoardState) => void;

  // Serialization
  exportToJSON: () => BoardState;
  importFromJSON: (state: BoardState) => void;
  importMultipleBoards: (boards: BoardState[], gap?: number) => void;
  loadTemplate: (state: BoardState, mode?: 'append' | 'replace') => void;
  clearBoard: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────
function getMaxZIndex(cards: Card[], shapes: Shape[] = [], textItems: TextItem[] = [], voteDots: VoteDot[] = [], images: ImageItem[] = []): number {
  const cardMax = cards.reduce((max, c) => Math.max(max, c.zIndex), 0);
  const shapeMax = shapes.reduce((max, s) => Math.max(max, s.zIndex), 0);
  const textMax = textItems.reduce((max, t) => Math.max(max, t.zIndex), 0);
  const voteMax = voteDots.reduce((max, d) => Math.max(max, d.zIndex), 0);
  const imageMax = images.reduce((max, image) => Math.max(max, image.zIndex), 0);
  return Math.max(cardMax, shapeMax, textMax, voteMax, imageMax);
}

function randomRotation(): number {
  return (Math.random() - 0.5) * 6;
}

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

function snapshot(cards: Card[], shapes: Shape[], connectors: Connector[], clusters: Cluster[], textItems: TextItem[], voteDots: VoteDot[], images: ImageItem[]): HistoryEntry {
  return {
    cards: cards.map(c => ({ ...c })),
    shapes: shapes.map(s => ({ ...s })),
    connectors: connectors.map(c => ({ ...c })),
    clusters: clusters.map(c => ({ ...c })),
    textItems: textItems.map(t => ({ ...t })),
    voteDots: voteDots.map(d => ({ ...d })),
    images: images.map(image => ({ ...image })),
  };
}

// ─── Store ──────────────────────────────────────────────────────────
export const useBoardStore = create<BoardStore>((set, get) => ({
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

  // ── Card Actions ────────────────────────────────────────────────
  addCard: (x, y, color = 'cream', clusterId) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const { clusters } = get();

    let assignedClusterId = clusterId;
    if (!assignedClusterId) {
      const containing = clusters.find(
        cl => x >= cl.x - 10 && x + DEFAULT_CARD_WIDTH <= cl.x + cl.width + 10 &&
          y >= cl.y - 10 && y + DEFAULT_CARD_HEIGHT <= cl.y + cl.height + 10
      );
      if (containing) {
        assignedClusterId = containing.id;
      }
    }

    get().pushHistory();
    if (get().soundEnabled) {
      SoundEffects.paperPlace();
      SoundEffects.pin();
    }

    const newCard: Card = {
      id,
      x,
      y,
      width: DEFAULT_CARD_WIDTH,
      height: DEFAULT_CARD_HEIGHT,
      color,
      title: '',
      body: '',
      eyebrow: '',
      clusterId: assignedClusterId,
      zIndex: getMaxZIndex(get().cards, get().shapes) + 1,
      rotation: randomRotation(),
      createdAt: now,
      updatedAt: now,
    };

    set(state => {
      const nextCards = [...state.cards, newCard];
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
        editingCardId: id,
        editingShapeId: null,
        editingClusterId: null,
        selectedIds: [id],
      };
    });
    return id;
  },

  importCards: (cardsToImport) => {
    if (cardsToImport.length === 0) return [];

    const { cards, shapes, clusters, textItems, voteDots } = get();
    const occupied = [
      ...cards.map(card => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
      ...shapes.map(shape => ({ x: shape.x, y: shape.y, width: shape.width, height: shape.height })),
      ...clusters.map(cluster => ({ x: cluster.x, y: cluster.y, width: cluster.width, height: cluster.height })),
      ...textItems.map(text => ({ x: text.x, y: text.y, width: text.width, height: text.fontSize * 2 })),
      ...voteDots.map(dot => ({ x: dot.x - 12, y: dot.y - 12, width: 24, height: 24 })),
    ];
    const layout = getImportLayout(cardsToImport.length, occupied);
    const firstZIndex = getMaxZIndex(cards, shapes, textItems, voteDots);
    const now = new Date().toISOString();
    const newCards = cardsToImport.map((card, index): Card => ({
      id: uuidv4(),
      ...layout[index],
      color: card.color,
      title: card.title,
      body: card.body,
      eyebrow: card.eyebrow,
      zIndex: firstZIndex + index + 1,
      rotation: randomRotation(),
      createdAt: now,
      updatedAt: now,
    }));

    get().pushHistory();
    if (get().soundEnabled) SoundEffects.paperPlace();
    set(state => ({
      cards: [...state.cards, ...newCards],
      clusters: recalculateClusters(state.clusters, [...state.cards, ...newCards], state.shapes),
      selectedIds: newCards.map(card => card.id),
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
    }));
    return newCards.map(card => card.id);
  },

  addImage: (src, name = 'Image', x = 100, y = 100, width = 320, height = 220, shape = 'rectangle') => {
    if (!src) return '';
    const id = uuidv4();
    const now = new Date().toISOString();
    get().pushHistory();
    const newImage: ImageItem = {
      id,
      x,
      y,
      width: Math.max(40, width),
      height: Math.max(40, height),
      src,
      name,
      shape,
      rotation: 0,
      zIndex: getMaxZIndex(get().cards, get().shapes, get().textItems, get().voteDots, get().images) + 1,
      createdAt: now,
      updatedAt: now,
    };
    set(state => ({
      images: [...state.images, newImage],
      selectedIds: [id],
      editingCardId: null,
      editingTextId: null,
      editingShapeId: null,
      editingClusterId: null,
    }));
    return id;
  },
  updateImage: (id, updates) => {
    get().pushHistory();
    set(state => ({ images: state.images.map(image => image.id === id ? { ...image, ...updates, updatedAt: new Date().toISOString() } : image) }));
  },
  deleteImage: (id) => {
    get().pushHistory();
    set(state => ({ images: state.images.filter(image => image.id !== id), selectedIds: state.selectedIds.filter(selectedId => selectedId !== id) }));
  },
  moveImage: (id, x, y) => set(state => ({ images: state.images.map(image => image.id === id ? { ...image, x, y, updatedAt: new Date().toISOString() } : image) })),
  bringImageToFront: (id) => set(state => ({ images: state.images.map(image => image.id === id ? { ...image, zIndex: getMaxZIndex(state.cards, state.shapes, state.textItems, state.voteDots, state.images) + 1 } : image) })),

  addCardToCluster: (clusterId: string, color = 'cream') => {
    const { clusters, cards } = get();
    const targetCluster = clusters.find(c => c.id === clusterId);
    if (!targetCluster) return '';

    const memberCards = cards.filter(c => c.clusterId === clusterId);
    let cardX = targetCluster.x + 28;
    let cardY = targetCluster.y + 46;

    if (memberCards.length > 0) {
      const lastCard = memberCards[memberCards.length - 1];
      cardX = lastCard.x;
      cardY = lastCard.y + lastCard.height + 16;
    }

    return get().addCard(cardX, cardY, color, clusterId);
  },

  updateCard: (id, updates) => {
    get().pushHistory();
    set(state => {
      const nextCards = state.cards.map(c =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
      };
    });
  },

  deleteCard: (id) => {
    get().pushHistory();
    set(state => {
      const nextCards = state.cards.filter(c => c.id !== id);
      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
        connectors: state.connectors.filter(
          c => c.fromCardId !== id && c.toCardId !== id
        ),
        selectedIds: state.selectedIds.filter(s => s !== id),
        editingCardId: state.editingCardId === id ? null : state.editingCardId,
      };
    });
  },

  moveCard: (id, x, y) => {
    set(state => {
      const targetCard = state.cards.find(c => c.id === id);
      if (!targetCard) return state;

      let updatedClusterId = targetCard.clusterId;
      const currentContainingCluster = state.clusters.find(
        cl => x >= cl.x - 20 && x + targetCard.width <= cl.x + cl.width + 20 &&
          y >= cl.y - 20 && y + targetCard.height <= cl.y + cl.height + 20
      );

      if (currentContainingCluster) {
        updatedClusterId = currentContainingCluster.id;
      } else if (targetCard.clusterId) {
        const oldCluster = state.clusters.find(cl => cl.id === targetCard.clusterId);
        if (oldCluster) {
          const farOutside =
            x < oldCluster.x - 120 || x > oldCluster.x + oldCluster.width + 120 ||
            y < oldCluster.y - 120 || y > oldCluster.y + oldCluster.height + 120;
          if (farOutside) {
            updatedClusterId = undefined;
          }
        }
      }

      const nextCards = state.cards.map(c =>
        c.id === id ? { ...c, x, y, clusterId: updatedClusterId, updatedAt: new Date().toISOString() } : c
      );

      const nextClusters = recalculateClusters(state.clusters, nextCards, state.shapes);
      return {
        cards: nextCards,
        clusters: nextClusters,
      };
    });
  },

  addTextItem: (x, y, text = '') => {
    const id = uuidv4(); const now = new Date().toISOString(); get().pushHistory();
    set(state => ({ textItems: [...state.textItems, { id, x, y, text, fontSize: 22, color: '#2b2420', width: 280, rotation: 0, zIndex: getMaxZIndex(state.cards, state.shapes) + 1, createdAt: now, updatedAt: now }], selectedIds: [id] }));
    return id;
  },
  updateTextItem: (id, updates) => { get().pushHistory(); set(state => ({ textItems: state.textItems.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) })); },
  deleteTextItem: (id) => { get().pushHistory(); set(state => ({ textItems: state.textItems.filter(t => t.id !== id), selectedIds: state.selectedIds.filter(s => s !== id) })); },
  moveTextItem: (id, x, y) => set(state => ({ textItems: state.textItems.map(t => t.id === id ? { ...t, x, y } : t) })),
  addVoteDot: (x, y, color = 'red') => { const id = uuidv4(); get().pushHistory(); set(state => ({ voteDots: [...state.voteDots, { id, x, y, color, zIndex: getMaxZIndex(state.cards, state.shapes) + 1, createdAt: new Date().toISOString() }], selectedIds: [id] })); return id; },
  deleteVoteDot: (id) => { get().pushHistory(); set(state => ({ voteDots: state.voteDots.filter(d => d.id !== id), selectedIds: state.selectedIds.filter(s => s !== id) })); },
  moveVoteDot: (id, x, y) => set(state => ({ voteDots: state.voteDots.map(d => d.id === id ? { ...d, x, y } : d) })),

  bringToFront: (id) => {
    set(state => ({
      cards: state.cards.map(c =>
        c.id === id
          ? { ...c, zIndex: getMaxZIndex(state.cards, state.shapes) + 1 }
          : c
      ),
    }));
  },

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
}));
