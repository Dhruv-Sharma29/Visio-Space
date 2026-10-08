import type { Card, Shape, Connector, Cluster, Tool, Viewport, CardColor, ShapeType, ShapeColor, ConnectorColor, ConnectorStyle, ClusterColor, TextItem, VoteDot, VoteColor, BoardState, HistoryEntry, ToolbarDock, ImageItem, BoardRole } from '../types/board';

export interface ConfirmDeleteModalState {
  isOpen: boolean;
  clusterId: string;
  clusterLabel: string;
  cardCount: number;
}

export interface BoardStore {
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
