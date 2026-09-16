// ─── Card Colors ────────────────────────────────────────────────────
export type CardColor = 'cream' | 'yellow' | 'pink' | 'green' | 'blue' | 'purple';

export const CARD_COLORS: Record<CardColor, { bg: string; border: string; eyebrow: string; pin: string }> = {
  cream: { bg: '#f4ecd8', border: '#e0d3ae', eyebrow: '#a3312b', pin: '#c0392b' },
  yellow: { bg: '#fff9c4', border: '#f0e68c', eyebrow: '#b8860b', pin: '#daa520' },
  pink: { bg: '#fce4ec', border: '#f8bbd0', eyebrow: '#c2185b', pin: '#e91e63' },
  green: { bg: '#e8f5e9', border: '#c8e6c9', eyebrow: '#2e7d32', pin: '#4caf50' },
  blue: { bg: '#e3f2fd', border: '#bbdefb', eyebrow: '#1565c0', pin: '#2196f3' },
  purple: { bg: '#f3e5f5', border: '#e1bee7', eyebrow: '#7b1fa2', pin: '#9c27b0' },
};

// ─── Shape Types & Colors ──────────────────────────────────────────
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'hexagon';

export type ShapeColor = 'cream' | 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange' | 'slate' | 'transparent';

export const SHAPE_COLORS: Record<ShapeColor, { bg: string; border: string; text: string; pin: string }> = {
  cream: { bg: '#f4ecd8', border: '#b89b72', text: '#2b2420', pin: '#c0392b' },
  yellow: { bg: '#fff9c4', border: '#d4af37', text: '#3e2723', pin: '#daa520' },
  pink: { bg: '#fce4ec', border: '#c2185b', text: '#4a148c', pin: '#e91e63' },
  green: { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20', pin: '#4caf50' },
  blue: { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1', pin: '#2196f3' },
  purple: { bg: '#f3e5f5', border: '#7b1fa2', text: '#4a148c', pin: '#9c27b0' },
  orange: { bg: '#fff3e0', border: '#e65100', text: '#bf360c', pin: '#f57c00' },
  slate: { bg: '#eceff1', border: '#455a64', text: '#263238', pin: '#607d8b' },
  transparent: { bg: 'transparent', border: '#5a4f42', text: '#2b2420', pin: '#2f4a63' },
};

// ─── Shape ──────────────────────────────────────────────────────────
export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: ShapeColor;
  text?: string;
  rotation: number;
  zIndex: number;
  clusterId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Card ───────────────────────────────────────────────────────────
export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: CardColor;
  title: string;
  body: string;
  eyebrow: string;
  clusterId?: string;
  zIndex: number;
  rotation: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Connector ──────────────────────────────────────────────────────
export type ConnectorStyle = 'solid' | 'dashed';
export type ConnectorColor = 'red' | 'blue' | 'gray';

export const CONNECTOR_COLORS: Record<ConnectorColor, string> = {
  red: '#a3312b',
  blue: '#2f4a63',
  gray: '#888888',
};

export interface Connector {
  id: string;
  // null once detached — use fromPoint/toPoint (a fixed canvas point) instead
  fromCardId: string | null;
  toCardId: string | null;
  fromPoint?: { x: number; y: number };
  toPoint?: { x: number; y: number };
  color: ConnectorColor;
  style: ConnectorStyle;
  label?: string;
}

// ─── Cluster ────────────────────────────────────────────────────────
export type ClusterColor = 'slate' | 'cream' | 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange';

export const CLUSTER_COLORS: Record<ClusterColor, { bg: string; border: string; badgeBg: string; text: string }> = {
  slate: { bg: 'rgba(74, 85, 104, 0.07)', border: 'rgba(74, 85, 104, 0.4)', badgeBg: '#2d3748', text: '#edf2f7' },
  cream: { bg: 'rgba(244, 236, 216, 0.12)', border: 'rgba(160, 111, 66, 0.35)', badgeBg: '#241d18', text: '#f4ecd8' },
  yellow: { bg: 'rgba(255, 249, 196, 0.18)', border: 'rgba(212, 175, 55, 0.45)', badgeBg: '#b8860b', text: '#fffde7' },
  pink: { bg: 'rgba(252, 228, 236, 0.18)', border: 'rgba(194, 24, 91, 0.4)', badgeBg: '#c2185b', text: '#fce4ec' },
  green: { bg: 'rgba(232, 245, 233, 0.18)', border: 'rgba(46, 125, 50, 0.4)', badgeBg: '#2e7d32', text: '#e8f5e9' },
  blue: { bg: 'rgba(227, 242, 253, 0.18)', border: 'rgba(21, 101, 192, 0.4)', badgeBg: '#1565c0', text: '#e3f2fd' },
  purple: { bg: 'rgba(243, 229, 245, 0.18)', border: 'rgba(123, 31, 162, 0.4)', badgeBg: '#7b1fa2', text: '#f3e5f5' },
  orange: { bg: 'rgba(255, 243, 224, 0.18)', border: 'rgba(230, 81, 0, 0.4)', badgeBg: '#e65100', text: '#fff3e0' },
};

export interface Cluster {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: ClusterColor;
}

export interface TextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  width: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type VoteColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';
export const VOTE_COLORS: Record<VoteColor, string> = {
  red: '#e05252', yellow: '#e0ad32', green: '#4eaa6a', blue: '#4d83c4', purple: '#8960b5',
};

export interface VoteDot {
  id: string;
  x: number;
  y: number;
  color: VoteColor;
  zIndex: number;
  createdAt: string;
}

export interface ImageItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  name: string;
  shape: ShapeType;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Tool ───────────────────────────────────────────────────────────
export type Tool = 'select' | 'card' | 'shape' | 'connector' | 'cluster' | 'text' | 'vote' | 'comment' | 'hand';
export type ToolbarDock = 'left' | 'right' | 'top' | 'bottom';

// ─── Viewport ───────────────────────────────────────────────────────
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

// ─── Board State ────────────────────────────────────────────────────
export interface BoardState {
  cards: Card[];
  shapes: Shape[];
  connectors: Connector[];
  clusters: Cluster[];
  textItems?: TextItem[];
  voteDots?: VoteDot[];
  images?: ImageItem[];
}

// ─── History Entry (for undo/redo) ──────────────────────────────────
export interface HistoryEntry {
  cards: Card[];
  shapes: Shape[];
  connectors: Connector[];
  clusters: Cluster[];
  textItems: TextItem[];
  voteDots: VoteDot[];
  images?: ImageItem[];
}

// ─── Template Definition ────────────────────────────────────────────
export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  state: BoardState;
}

// ─── Permissions & Sharing ──────────────────────────────────────────
export type BoardRole = 'owner' | 'editor' | 'viewer';
export type PublicAccessLevel = 'private' | 'viewer' | 'editor';

export interface BoardCollaborator {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  role: BoardRole;
  joinedAt?: string;
}

export interface BoardShareSettings {
  boardId: string;
  publicAccess: PublicAccessLevel;
  shareToken: string;
  shareUrl: string;
}

// ─── Comments & Notifications ───────────────────────────────────────
export interface CommentItem {
  id: string;
  boardId: string;
  cardId?: string | null;
  x: number;
  y: number;
  authorId?: string | null;
  authorName: string;
  authorAvatar?: string | null;
  body: string;
  parentCommentId?: string | null;
  resolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: CommentItem[];
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: 'mention' | 'reply' | 'comment_resolve';
  title: string;
  body: string;
  boardId: string;
  commentId?: string | null;
  cardId?: string | null;
  x?: number;
  y?: number;
  read: boolean;
  createdAt: string;
}

// ─── Version History & Snapshots ─────────────────────────────────────
export interface BoardSnapshot {
  id: string;
  boardId: string;
  name: string;
  description?: string;
  state: BoardState;
  createdBy?: string | null;
  createdByName: string;
  createdAt: string;
  itemCount: {
    cards: number;
    shapes: number;
    clusters: number;
  };
}

// ─── Activity Log ───────────────────────────────────────────────────
export type ActivityActionType =
  | 'card_add'
  | 'card_delete'
  | 'card_edit'
  | 'shape_add'
  | 'cluster_create'
  | 'comment_add'
  | 'comment_resolve'
  | 'version_restore'
  | 'version_create'
  | 'board_share_update';

export interface ActivityLogItem {
  id: string;
  boardId: string;
  userId?: string | null;
  userName: string;
  userAvatar?: string | null;
  action: ActivityActionType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── In-Board Search ────────────────────────────────────────────────
export type SearchMatchCategory = 'card' | 'shape' | 'text' | 'cluster' | 'comment';

export interface SearchMatch {
  id: string;
  category: SearchMatchCategory;
  title: string;
  snippet: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  commentId?: string;
}

// ─── Projects / Folders ─────────────────────────────────────────────
export interface BoardProject {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt?: string;
}


