import { v4 as uuidv4 } from 'uuid';
import type {
  BoardState,
  Card,
  Shape,
  Connector,
  Cluster,
  TextItem,
  VoteDot,
  ImageItem,
} from '../types/board';
import { normalizeBoardState } from './boardValidation.ts';

export interface BoardBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  hasItems: boolean;
}

export interface BoardPlacement {
  boardIndex: number;
  offsetX: number;
  offsetY: number;
  originalBounds: BoardBounds;
  placedBounds: BoardBounds;
}

export const DEFAULT_BOARD_VERTICAL_GAP = 120;
export const DEFAULT_START_X = 80;
export const DEFAULT_START_Y = 80;

/**
 * Calculates cluster bounds based on member cards and shapes.
 */
export function recalculateClustersInternal(
  clusters: Cluster[],
  cards: Card[],
  shapes: Shape[] = [],
): Cluster[] {
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

/**
 * Calculates the bounding box of all content within a board.
 */
export function computeBoardBounds(board: BoardState): BoardBounds {
  const items: Array<{ x: number; y: number; width: number; height: number }> = [
    ...(board.cards || []).map(c => ({ x: c.x, y: c.y, width: c.width, height: c.height })),
    ...(board.shapes || []).map(s => ({ x: s.x, y: s.y, width: s.width, height: s.height })),
    ...(board.clusters || []).map(cl => ({ x: cl.x, y: cl.y, width: cl.width, height: cl.height })),
    ...(board.textItems || []).map(t => ({ x: t.x, y: t.y, width: t.width, height: Math.max(40, t.fontSize * 2) })),
    ...(board.images || []).map(img => ({ x: img.x, y: img.y, width: img.width, height: img.height })),
    ...(board.voteDots || []).map(d => ({ x: d.x - 12, y: d.y - 12, width: 24, height: 24 })),
  ];

  if (items.length === 0) {
    return {
      minX: DEFAULT_START_X,
      minY: DEFAULT_START_Y,
      maxX: DEFAULT_START_X + 320,
      maxY: DEFAULT_START_Y + 220,
      width: 320,
      height: 220,
      hasItems: false,
    };
  }

  const minX = Math.min(...items.map(i => i.x));
  const minY = Math.min(...items.map(i => i.y));
  const maxX = Math.max(...items.map(i => i.x + i.width));
  const maxY = Math.max(...items.map(i => i.y + i.height));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(40, maxX - minX),
    height: Math.max(40, maxY - minY),
    hasItems: true,
  };
}

export interface LayoutOptions {
  gap?: number;
  startX?: number;
  startY?: number;
}

/**
 * Calculates vertical placement offsets for multiple boards.
 * Board 1 is placed at the top.
 * Each subsequent board is placed directly below the previous board with a consistent vertical gap,
 * aligned to the same horizontal starting position.
 */
export function calculateMultiBoardPlacements(
  boards: BoardState[],
  options: LayoutOptions = {},
): BoardPlacement[] {
  if (boards.length === 0) return [];

  const gap = options.gap ?? DEFAULT_BOARD_VERTICAL_GAP;
  const placements: BoardPlacement[] = [];

  // Determine starting position from options or the first board
  const firstBounds = computeBoardBounds(boards[0]);
  const targetX = options.startX ?? (firstBounds.hasItems ? Math.max(DEFAULT_START_X, firstBounds.minX) : DEFAULT_START_X);
  const initialY = options.startY ?? (firstBounds.hasItems ? Math.max(DEFAULT_START_Y, firstBounds.minY) : DEFAULT_START_Y);

  let currentTopY = initialY;

  for (let i = 0; i < boards.length; i += 1) {
    const originalBounds = computeBoardBounds(boards[i]);
    const offsetX = targetX - originalBounds.minX;
    const offsetY = currentTopY - originalBounds.minY;

    const placedBounds: BoardBounds = {
      minX: targetX,
      minY: currentTopY,
      maxX: targetX + originalBounds.width,
      maxY: currentTopY + originalBounds.height,
      width: originalBounds.width,
      height: originalBounds.height,
      hasItems: originalBounds.hasItems,
    };

    placements.push({
      boardIndex: i,
      offsetX,
      offsetY,
      originalBounds,
      placedBounds,
    });

    // Next board starts below this board's bottom plus the gap
    currentTopY = placedBounds.maxY + gap;
  }

  return placements;
}

/**
 * Combines multiple board states into a single unified board state,
 * arranging them vertically, preserving all elements, relationships (threads/connectors, clusters),
 * and remapping IDs to prevent conflicts.
 */
export function combineBoardsForImport(
  boards: BoardState[],
  options: LayoutOptions = {},
): BoardState {
  if (boards.length === 0) {
    return {
      cards: [],
      shapes: [],
      connectors: [],
      clusters: [],
      textItems: [],
      voteDots: [],
      images: [],
    };
  }

  const normalizedBoards = boards.map(normalizeBoardState);

  // If only one board, and no layout overrides, preserve exact positions and IDs for backward compatibility
  if (normalizedBoards.length === 1 && options.gap === undefined && options.startX === undefined && options.startY === undefined) {
    return normalizedBoards[0];
  }

  const placements = calculateMultiBoardPlacements(normalizedBoards, options);

  const allCards: Card[] = [];
  const allShapes: Shape[] = [];
  const allConnectors: Connector[] = [];
  const allClusters: Cluster[] = [];
  const allTextItems: TextItem[] = [];
  const allVoteDots: VoteDot[] = [];
  const allImages: ImageItem[] = [];

  let currentZIndexBase = 0;

  for (let bIndex = 0; bIndex < normalizedBoards.length; bIndex += 1) {
    const board = normalizedBoards[bIndex];
    const { offsetX, offsetY } = placements[bIndex];

    const idMap = new Map<string, string>();
    const getMappedId = (oldId: string): string => {
      if (!idMap.has(oldId)) {
        idMap.set(oldId, uuidv4());
      }
      return idMap.get(oldId)!;
    };

    // 1. Clusters
    const boardClusters = (board.clusters || []).map(cl => {
      const newId = getMappedId(cl.id);
      return {
        ...cl,
        id: newId,
        x: Math.round(cl.x + offsetX),
        y: Math.round(cl.y + offsetY),
      };
    });

    // 2. Cards
    const boardCards = (board.cards || []).map(c => {
      const newId = getMappedId(c.id);
      const newClusterId = c.clusterId ? getMappedId(c.clusterId) : undefined;
      return {
        ...c,
        id: newId,
        x: Math.round(c.x + offsetX),
        y: Math.round(c.y + offsetY),
        clusterId: newClusterId,
        zIndex: currentZIndexBase + (c.zIndex || 1),
      };
    });

    // 3. Shapes
    const boardShapes = (board.shapes || []).map(s => {
      const newId = getMappedId(s.id);
      const newClusterId = s.clusterId ? getMappedId(s.clusterId) : undefined;
      return {
        ...s,
        id: newId,
        x: Math.round(s.x + offsetX),
        y: Math.round(s.y + offsetY),
        clusterId: newClusterId,
        zIndex: currentZIndexBase + (s.zIndex || 1),
      };
    });

    // 4. Connectors (Threads)
    const validTargetIds = new Set([...boardCards.map(c => c.id), ...boardShapes.map(s => s.id)]);
    const boardConnectors = (board.connectors || []).map(conn => {
      const newFromId = conn.fromCardId ? getMappedId(conn.fromCardId) : null;
      const newToId = conn.toCardId ? getMappedId(conn.toCardId) : null;
      return {
        ...conn,
        id: uuidv4(),
        fromCardId: newFromId,
        toCardId: newToId,
      };
    }).filter(conn =>
      (conn.fromCardId === null || validTargetIds.has(conn.fromCardId)) &&
      (conn.toCardId === null || validTargetIds.has(conn.toCardId))
    );

    // 5. TextItems
    const boardTextItems = (board.textItems || []).map(t => ({
      ...t,
      id: uuidv4(),
      x: Math.round(t.x + offsetX),
      y: Math.round(t.y + offsetY),
      zIndex: currentZIndexBase + (t.zIndex || 1),
    }));

    // 6. VoteDots
    const boardVoteDots = (board.voteDots || []).map(d => ({
      ...d,
      id: uuidv4(),
      x: Math.round(d.x + offsetX),
      y: Math.round(d.y + offsetY),
      zIndex: currentZIndexBase + (d.zIndex || 1),
    }));

    // 7. Images
    const boardImages = (board.images || []).map(img => ({
      ...img,
      id: uuidv4(),
      x: Math.round(img.x + offsetX),
      y: Math.round(img.y + offsetY),
      zIndex: currentZIndexBase + (img.zIndex || 1),
    }));

    // Increment currentZIndexBase for next board
    const boardMaxZ = Math.max(
      ...boardCards.map(c => c.zIndex),
      ...boardShapes.map(s => s.zIndex),
      ...boardTextItems.map(t => t.zIndex),
      ...boardVoteDots.map(d => d.zIndex),
      ...boardImages.map(i => i.zIndex),
      0,
    );
    currentZIndexBase = boardMaxZ;

    allCards.push(...boardCards);
    allShapes.push(...boardShapes);
    allConnectors.push(...boardConnectors);
    allClusters.push(...boardClusters);
    allTextItems.push(...boardTextItems);
    allVoteDots.push(...boardVoteDots);
    allImages.push(...boardImages);
  }

  // Recalculate cluster bounds with shifted member positions
  const adjustedClusters = recalculateClustersInternal(allClusters, allCards, allShapes);

  return {
    cards: allCards,
    shapes: allShapes,
    connectors: allConnectors,
    clusters: adjustedClusters,
    textItems: allTextItems,
    voteDots: allVoteDots,
    images: allImages,
  };
}
