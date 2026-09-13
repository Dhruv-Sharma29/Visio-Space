import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and window for Node environment
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
  writable: true,
});

import { commentService } from '../src/services/commentService.ts';
import { notificationService } from '../src/services/notificationService.ts';

test('commentService.extractMentions parses @handles correctly and ignores emails', () => {
  const text1 = 'Hello @sarah_pm and @alex_dev! Please review.';
  const mentions1 = commentService.extractMentions(text1);
  assert.deepEqual(mentions1, ['sarah_pm', 'alex_dev']);

  // Edge case: email address should not be treated as a mention
  const text2 = 'Contact us at team@company.com or @john';
  const mentions2 = commentService.extractMentions(text2);
  assert.deepEqual(mentions2, ['john']);

  // Trailing punctuation & brackets
  const text3 = 'Great job @maria! Is this ready? (@maria, @kevin)';
  const mentions3 = commentService.extractMentions(text3);
  assert.deepEqual(mentions3, ['maria', 'kevin']);

  // Empty string
  assert.deepEqual(commentService.extractMentions('No mentions here'), []);
});

test('commentService creates, retrieves, and replies to comments in local mode', async () => {
  const boardId = 'board-test-comments-1';

  // Create root comment
  const rootComment = await commentService.createComment(boardId, {
    body: 'We need to redesign this card layout @sarah',
    x: 150,
    y: 200,
    cardId: 'card-101',
    authorId: 'user-author-1',
    authorName: 'Dhruv Sharma',
  });

  assert.ok(rootComment.id.startsWith('comment_'));
  assert.equal(rootComment.boardId, boardId);
  assert.equal(rootComment.body, 'We need to redesign this card layout @sarah');
  assert.equal(rootComment.cardId, 'card-101');
  assert.equal(rootComment.x, 150);
  assert.equal(rootComment.y, 200);
  assert.equal(rootComment.resolved, false);
  assert.equal(rootComment.replies.length, 0);

  // Retrieve comments
  const comments = await commentService.getBoardComments(boardId);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].id, rootComment.id);

  // Add reply
  const reply = await commentService.addReply(
    boardId,
    rootComment.id,
    {
      body: 'Agreed, I will take care of the typography updates.',
      authorId: 'user-author-2',
      authorName: 'Sarah Jenkins',
    }
  );

  assert.ok(reply);
  assert.equal(reply.authorName, 'Sarah Jenkins');
  assert.equal(reply.body, 'Agreed, I will take care of the typography updates.');

  const updatedComments = await commentService.getBoardComments(boardId);
  assert.equal(updatedComments[0].replies.length, 1);
  assert.equal(updatedComments[0].replies[0].id, reply.id);

  // Resolve comment
  await commentService.resolveComment(boardId, rootComment.id, true, 'Sarah Jenkins');
  const resolvedComments = await commentService.getBoardComments(boardId);
  assert.equal(resolvedComments[0].resolved, true);
  assert.equal(resolvedComments[0].resolvedBy, 'Sarah Jenkins');

  // Unresolve comment
  await commentService.resolveComment(boardId, rootComment.id, false);
  const reopenedComments = await commentService.getBoardComments(boardId);
  assert.equal(reopenedComments[0].resolved, false);

  // Delete comment
  await commentService.deleteComment(boardId, rootComment.id);
  const finalComments = await commentService.getBoardComments(boardId);
  assert.equal(finalComments.length, 0);
});

test('notificationService manages notifications, unread count, and mark-as-read', async () => {
  const userId = 'user-test-notifs-1';

  // Create notification 1
  const notif1 = await notificationService.createNotification({
    userId,
    boardId: 'board-123',
    commentId: 'comment_1',
    type: 'mention',
    title: 'Sarah Jenkins mentioned you in a comment',
    body: 'We need to redesign this layout',
    x: 300,
    y: 400,
  });

  assert.ok(notif1.id.startsWith('notif_'));
  assert.equal(notif1.read, false);

  // Create notification 2
  const notif2 = await notificationService.createNotification({
    userId,
    boardId: 'board-123',
    commentId: 'comment_1',
    type: 'reply',
    title: 'Alex River replied to your comment',
    body: 'Agreed, on it!',
    x: 300,
    y: 400,
  });

  // Verify list & unread count
  let count = await notificationService.getUnreadCount(userId);
  assert.equal(count, 2);

  const notifs = await notificationService.getNotifications(userId);
  assert.equal(notifs.length, 2);

  // Mark first as read
  await notificationService.markAsRead(userId, notif1.id);
  count = await notificationService.getUnreadCount(userId);
  assert.equal(count, 1);

  // Mark all as read
  await notificationService.markAllAsRead(userId);
  count = await notificationService.getUnreadCount(userId);
  assert.equal(count, 0);

  // Delete notification
  await notificationService.deleteNotification(userId, notif2.id);

  const remaining = await notificationService.getNotifications(userId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, notif1.id);
});
