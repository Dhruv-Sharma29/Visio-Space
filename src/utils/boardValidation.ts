import type {
  BoardState,
  Card,
  CardColor,
  Cluster,
  ClusterColor,
  Connector,
  ConnectorColor,
  ConnectorStyle,
  Shape,
  ShapeColor,
  ShapeType,
  TextItem,
  VoteColor,
  VoteDot,
  ImageItem,
} from '../types/board';

type RecordValue = Record<string, unknown>;

const CARD_COLORS: CardColor[] = ['cream', 'yellow', 'pink', 'green', 'blue', 'purple'];
const SHAPE_COLORS: ShapeColor[] = [...CARD_COLORS, 'orange', 'slate', 'transparent'];
const SHAPE_TYPES: ShapeType[] = ['rectangle', 'circle', 'triangle', 'diamond', 'star', 'hexagon'];
const CONNECTOR_COLORS: ConnectorColor[] = ['red', 'blue', 'gray'];
const CONNECTOR_STYLES: ConnectorStyle[] = ['solid', 'dashed'];
const CLUSTER_COLORS: ClusterColor[] = ['slate', ...CARD_COLORS, 'orange'];
const VOTE_COLORS: VoteColor[] = ['red', 'yellow', 'green', 'blue', 'purple'];

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function textColorOr(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#2b2420';
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function normalizeCard(value: unknown): Card | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: Math.max(20, numberOr(value.width, 220)),
    height: Math.max(20, numberOr(value.height, 140)),
    color: oneOf(value.color, CARD_COLORS, 'cream'),
    title: stringOr(value.title),
    body: stringOr(value.body),
    eyebrow: stringOr(value.eyebrow),
    ...(typeof value.clusterId === 'string' ? { clusterId: value.clusterId } : {}),
    zIndex: numberOr(value.zIndex, 1),
    rotation: numberOr(value.rotation, 0),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
    updatedAt: stringOr(value.updatedAt, new Date().toISOString()),
  };
}

function normalizeShape(value: unknown): Shape | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    type: oneOf(value.type, SHAPE_TYPES, 'rectangle'),
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: Math.max(20, numberOr(value.width, 180)),
    height: Math.max(20, numberOr(value.height, 120)),
    color: oneOf(value.color, SHAPE_COLORS, 'cream'),
    ...(typeof value.text === 'string' ? { text: value.text } : {}),
    rotation: numberOr(value.rotation, 0),
    zIndex: numberOr(value.zIndex, 1),
    ...(typeof value.clusterId === 'string' ? { clusterId: value.clusterId } : {}),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
    updatedAt: stringOr(value.updatedAt, new Date().toISOString()),
  };
}

function normalizePoint(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return undefined;
  return { x: value.x, y: value.y };
}

function normalizeConnector(value: unknown): Connector | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;

  const fromCardId = typeof value.fromCardId === 'string' ? value.fromCardId : null;
  const toCardId = typeof value.toCardId === 'string' ? value.toCardId : null;
  const fromPoint = normalizePoint(value.fromPoint);
  const toPoint = normalizePoint(value.toPoint);
  // Each end needs either a linked item id or a fixed (detached) point to be renderable.
  if (!fromCardId && !fromPoint) return null;
  if (!toCardId && !toPoint) return null;

  return {
    id: value.id,
    fromCardId,
    toCardId,
    ...(fromPoint ? { fromPoint } : {}),
    ...(toPoint ? { toPoint } : {}),
    color: oneOf(value.color, CONNECTOR_COLORS, 'red'),
    style: oneOf(value.style, CONNECTOR_STYLES, 'solid'),
    ...(typeof value.label === 'string' ? { label: value.label } : {}),
  };
}

function normalizeCluster(value: unknown): Cluster | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    label: stringOr(value.label, 'Untitled Group'),
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: Math.max(100, numberOr(value.width, 320)),
    height: Math.max(80, numberOr(value.height, 220)),
    color: oneOf(value.color, CLUSTER_COLORS, 'slate'),
  };
}

function normalizeTextItem(value: unknown): TextItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    text: stringOr(value.text),
    fontSize: Math.max(8, numberOr(value.fontSize, 22)),
    color: textColorOr(value.color),
    width: Math.max(40, numberOr(value.width, 280)),
    rotation: numberOr(value.rotation, 0),
    zIndex: numberOr(value.zIndex, 1),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
    updatedAt: stringOr(value.updatedAt, new Date().toISOString()),
  };
}

function normalizeVoteDot(value: unknown): VoteDot | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    color: oneOf(value.color, VOTE_COLORS, 'red'),
    zIndex: numberOr(value.zIndex, 1),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
  };
}

function normalizeImage(value: unknown): ImageItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.src !== 'string' || !value.src) return null;
  return {
    id: value.id,
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: Math.max(40, numberOr(value.width, 320)),
    height: Math.max(40, numberOr(value.height, 220)),
    src: value.src,
    name: stringOr(value.name, 'Image'),
    shape: oneOf(value.shape, SHAPE_TYPES, 'rectangle'),
    rotation: numberOr(value.rotation, 0),
    zIndex: numberOr(value.zIndex, 1),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
    updatedAt: stringOr(value.updatedAt, new Date().toISOString()),
  };
}

function normalizedArray<T>(value: unknown, normalize: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalize).filter((item): item is T => item !== null);
}

/** Safely loads current and legacy JSON backups without trusting their shape. */
export function normalizeBoardState(input: unknown): BoardState {
  const raw = isRecord(input) ? input : {};
  return {
    cards: normalizedArray(raw.cards, normalizeCard),
    shapes: normalizedArray(raw.shapes, normalizeShape),
    connectors: normalizedArray(raw.connectors, normalizeConnector),
    clusters: normalizedArray(raw.clusters, normalizeCluster),
    textItems: normalizedArray(raw.textItems, normalizeTextItem),
    voteDots: normalizedArray(raw.voteDots, normalizeVoteDot),
    images: normalizedArray(raw.images, normalizeImage),
  };
}
