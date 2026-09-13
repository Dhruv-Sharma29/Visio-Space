import test from 'node:test';
import assert from 'node:assert/strict';

import { searchService } from '../src/services/searchService.ts';
import type { Card, Shape, Cluster, TextItem, CommentItem } from '../src/types/board.ts';

test('searchService.searchCanvas indexes and matches across cards, shapes, clusters, text, and comments', () => {
  const cards: Card[] = [
    {
      id: 'card-1',
      title: 'Checkout Flow Redesign',
      body: 'Stripe 3D secure payment failure rate was 14%',
      eyebrow: 'CHECKOUT',
      color: 'yellow',
      x: 100,
      y: 100,
      width: 220,
      height: 140,
      zIndex: 1,
      rotation: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'card-2',
      title: 'Onboarding Analytics',
      body: 'Drop-off occurs on phone verification step',
      eyebrow: 'METRICS',
      color: 'blue',
      x: 350,
      y: 100,
      width: 220,
      height: 140,
      zIndex: 2,
      rotation: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const shapes: Shape[] = [
    {
      id: 'shape-1',
      type: 'rectangle',
      x: 50,
      y: 50,
      width: 500,
      height: 300,
      color: 'slate',
      text: 'Conversion Funnel Milestone 2',
      rotation: 0,
      zIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const clusters: Cluster[] = [
    {
      id: 'cluster-1',
      label: 'Growth Opportunities Q4',
      x: 80,
      y: 80,
      width: 600,
      height: 400,
      color: 'slate',
    },
  ];

  const textItems: TextItem[] = [
    {
      id: 'text-1',
      text: 'Target Metric: 80% completion',
      x: 700,
      y: 200,
      fontSize: 20,
      color: '#ffffff',
      width: 200,
      rotation: 0,
      zIndex: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const comments: CommentItem[] = [
    {
      id: 'comm-1',
      boardId: 'b1',
      body: 'Can we sync with the payments team regarding Stripe?',
      x: 150,
      y: 150,
      authorId: 'u1',
      authorName: 'Sarah Chen',
      resolved: false,
      replies: [
        {
          id: 'rep-1',
          commentId: 'comm-1',
          body: 'Scheduled for tomorrow morning.',
          authorId: 'u2',
          authorName: 'Alex Dev',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // 1. Search for "Stripe" -> matches card-1 and comm-1
  const stripeMatches = searchService.searchCanvas({
    query: 'stripe',
    category: 'all',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(stripeMatches.length, 2);
  assert.equal(stripeMatches[0].category, 'card');
  assert.equal(stripeMatches[0].id, 'card-1');
  assert.equal(stripeMatches[1].category, 'comment');
  assert.equal(stripeMatches[1].id, 'comm-1');

  // 2. Search for "scheduled" -> matches reply in comment
  const replyMatches = searchService.searchCanvas({
    query: 'scheduled',
    category: 'all',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(replyMatches.length, 1);
  assert.equal(replyMatches[0].category, 'comment');
  assert.equal(replyMatches[0].id, 'rep-1');
  assert.equal(replyMatches[0].commentId, 'comm-1');

  // 3. Search for "Milestone" -> matches shape
  const shapeMatches = searchService.searchCanvas({
    query: 'Milestone',
    category: 'all',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(shapeMatches.length, 1);
  assert.equal(shapeMatches[0].category, 'shape');
  assert.equal(shapeMatches[0].id, 'shape-1');

  // 4. Category filtering: only "card"
  const cardOnlyMatches = searchService.searchCanvas({
    query: 'stripe',
    category: 'card',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(cardOnlyMatches.length, 1);
  assert.equal(cardOnlyMatches[0].id, 'card-1');

  // 5. Category filtering: only "cluster"
  const clusterMatches = searchService.searchCanvas({
    query: 'Growth Opportunities',
    category: 'cluster',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(clusterMatches.length, 1);
  assert.equal(clusterMatches[0].id, 'cluster-1');
  assert.equal(clusterMatches[0].title, 'Group: Growth Opportunities Q4');

  // 6. Empty query returns empty results
  const emptyMatches = searchService.searchCanvas({
    query: '   ',
    category: 'all',
    cards,
    shapes,
    clusters,
    textItems,
    comments,
  });

  assert.equal(emptyMatches.length, 0);
});
