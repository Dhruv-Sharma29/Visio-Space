import type { Card, Shape, Connector, Cluster, TextItem, VoteDot, ImageItem, HistoryEntry } from '../types/board';

export const MAX_HISTORY = 50;
export const DEFAULT_CARD_WIDTH = 220;
export const DEFAULT_CARD_HEIGHT = 140;

export function recalculateClusters(clusters: Cluster[], cards: Card[], shapes: Shape[] = []): Cluster[] {
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

export function getMaxZIndex(cards: Card[], shapes: Shape[] = [], textItems: TextItem[] = [], voteDots: VoteDot[] = [], images: ImageItem[] = []): number {
  const cardMax = cards.reduce((max, c) => Math.max(max, c.zIndex), 0);
  const shapeMax = shapes.reduce((max, s) => Math.max(max, s.zIndex), 0);
  const textMax = textItems.reduce((max, t) => Math.max(max, t.zIndex), 0);
  const voteMax = voteDots.reduce((max, d) => Math.max(max, d.zIndex), 0);
  const imageMax = images.reduce((max, image) => Math.max(max, image.zIndex), 0);
  return Math.max(cardMax, shapeMax, textMax, voteMax, imageMax);
}

export function randomRotation(): number {
  return (Math.random() - 0.5) * 6;
}

export function snapshot(cards: Card[], shapes: Shape[], connectors: Connector[], clusters: Cluster[], textItems: TextItem[], voteDots: VoteDot[], images: ImageItem[]): HistoryEntry {
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
