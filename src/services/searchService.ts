import type { Card, Shape, Cluster, TextItem, CommentItem, SearchMatch, SearchMatchCategory } from '../types/board.ts';

export interface CanvasSearchParams {
  query: string;
  category?: 'all' | SearchMatchCategory;
  cards: Card[];
  shapes: Shape[];
  clusters: Cluster[];
  textItems: TextItem[];
  comments?: CommentItem[];
}

export const searchService = {
  searchCanvas({
    query,
    category = 'all',
    cards,
    shapes,
    clusters,
    textItems,
    comments = [],
  }: CanvasSearchParams): SearchMatch[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchMatch[] = [];

    // 1. Cards
    if (category === 'all' || category === 'card') {
      cards.forEach((card) => {
        const fullText = [card.eyebrow, card.title, card.body].filter(Boolean).join(' ');
        if (fullText.toLowerCase().includes(q)) {
          results.push({
            id: card.id,
            category: 'card',
            title: card.title || card.eyebrow || 'Sticky Card',
            snippet: (card.body || fullText).slice(0, 80),
            x: card.x,
            y: card.y,
            width: card.width || 220,
            height: card.height || 140,
            color: card.color,
          });
        }
      });
    }

    // 2. Shapes
    if (category === 'all' || category === 'shape') {
      shapes.forEach((shape) => {
        const text = shape.text || '';
        if (text.toLowerCase().includes(q)) {
          results.push({
            id: shape.id,
            category: 'shape',
            title: `${shape.type.toUpperCase()}: ${text.slice(0, 30)}`,
            snippet: text,
            x: shape.x,
            y: shape.y,
            width: shape.width || 120,
            height: shape.height || 120,
            color: shape.color,
          });
        }
      });
    }

    // 3. Text Items
    if (category === 'all' || category === 'text') {
      textItems.forEach((item) => {
        const text = item.text || '';
        if (text.toLowerCase().includes(q)) {
          results.push({
            id: item.id,
            category: 'text',
            title: text.slice(0, 40) || 'Canvas Text',
            snippet: text,
            x: item.x,
            y: item.y,
            width: 160,
            height: 40,
          });
        }
      });
    }

    // 4. Clusters / Groups
    if (category === 'all' || category === 'cluster') {
      clusters.forEach((cluster) => {
        const label = cluster.label || '';
        if (label.toLowerCase().includes(q)) {
          results.push({
            id: cluster.id,
            category: 'cluster',
            title: `Group: ${label}`,
            snippet: `Cluster group: ${label}`,
            x: cluster.x,
            y: cluster.y,
            width: cluster.width,
            height: cluster.height,
            color: cluster.color,
          });
        }
      });
    }

    // 5. Comments & Replies
    if (category === 'all' || category === 'comment') {
      comments.forEach((comment) => {
        const body = comment.body || '';
        if (body.toLowerCase().includes(q)) {
          results.push({
            id: comment.id,
            category: 'comment',
            title: `Comment by ${comment.authorName}`,
            snippet: body,
            x: comment.x,
            y: comment.y,
            width: 40,
            height: 40,
            commentId: comment.id,
          });
        }

        comment.replies?.forEach((reply) => {
          const rBody = reply.body || '';
          if (rBody.toLowerCase().includes(q)) {
            results.push({
              id: reply.id,
              category: 'comment',
              title: `Reply by ${reply.authorName}`,
              snippet: rBody,
              x: comment.x,
              y: comment.y,
              width: 40,
              height: 40,
              commentId: comment.id,
            });
          }
        });
      });
    }

    return results;
  },
};
