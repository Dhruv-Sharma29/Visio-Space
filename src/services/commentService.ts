import { supabase } from '../lib/supabase.ts';
import type { CommentItem } from '../types/board.ts';
import { notificationService } from './notificationService.ts';
import { sharingService } from './sharingService.ts';

const LOCAL_COMMENTS_PREFIX = 'visiospace_comments_';

function getLocalComments(boardId: string): CommentItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_COMMENTS_PREFIX}${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalComments(boardId: string, comments: CommentItem[]) {
  try {
    localStorage.setItem(`${LOCAL_COMMENTS_PREFIX}${boardId}`, JSON.stringify(comments));
  } catch {}
}

export interface CreateCommentParams {
  cardId?: string | null;
  x: number;
  y: number;
  body: string;
  authorId?: string | null;
  authorName: string;
  authorAvatar?: string | null;
}

export interface CreateReplyParams {
  body: string;
  authorId?: string | null;
  authorName: string;
  authorAvatar?: string | null;
}

export const commentService = {
  /**
   * Extracts distinct @mentions from a comment body.
   */
  extractMentions(text: string): string[] {
    const matches = Array.from(text.matchAll(/(?:^|[\s([<{])@([a-zA-Z0-9_-]+)/g));
    if (!matches || matches.length === 0) return [];
    const usernames = matches.map(m => m[1].toLowerCase());
    return Array.from(new Set(usernames));
  },

  /**
   * Retrieves all comments for a board, with replies nested inside root comments.
   */
  async getBoardComments(boardId: string): Promise<CommentItem[]> {
    if (boardId.startsWith('board-') || !supabase) {
      const all = getLocalComments(boardId);
      return this.nestComments(all);
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        const local = getLocalComments(boardId);
        return this.nestComments(local);
      }

      const items: CommentItem[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        boardId: String(row.board_id),
        cardId: row.card_id ? String(row.card_id) : null,
        x: Number(row.x || 0),
        y: Number(row.y || 0),
        authorId: row.author_id ? String(row.author_id) : null,
        authorName: String(row.author_name || 'Collaborator'),
        authorAvatar: row.author_avatar ? String(row.author_avatar) : null,
        body: String(row.body || ''),
        parentCommentId: row.parent_comment_id ? String(row.parent_comment_id) : null,
        resolved: Boolean(row.resolved),
        resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
        resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));

      // Cache locally for offline availability
      saveLocalComments(boardId, items);
      return this.nestComments(items);
    } catch {
      const local = getLocalComments(boardId);
      return this.nestComments(local);
    }
  },

  /**
   * Helper to nest replies under root comments.
   */
  nestComments(allComments: CommentItem[]): CommentItem[] {
    const rootComments = allComments.filter(c => !c.parentCommentId);
    const replies = allComments.filter(c => Boolean(c.parentCommentId));

    const replyMap = new Map<string, CommentItem[]>();
    for (const reply of replies) {
      const pId = reply.parentCommentId!;
      const existing = replyMap.get(pId) || [];
      existing.push(reply);
      replyMap.set(pId, existing);
    }

    return rootComments.map(root => ({
      ...root,
      replies: replyMap.get(root.id) || [],
    }));
  },

  /**
   * Creates a new root comment attached to a card or free canvas coordinates.
   */
  async createComment(boardId: string, params: CreateCommentParams): Promise<CommentItem> {
    const now = new Date().toISOString();
    const commentId = `comment_${Math.random().toString(36).slice(2, 10)}`;

    const newComment: CommentItem = {
      id: commentId,
      boardId,
      cardId: params.cardId || null,
      x: params.x,
      y: params.y,
      authorId: params.authorId || null,
      authorName: params.authorName || 'Collaborator',
      authorAvatar: params.authorAvatar || null,
      body: params.body.trim(),
      parentCommentId: null,
      resolved: false,
      createdAt: now,
      updatedAt: now,
      replies: [],
    };

    // Save locally
    const local = getLocalComments(boardId);
    local.push(newComment);
    saveLocalComments(boardId, local);

    // Save to Supabase Cloud if available
    if (!boardId.startsWith('board-') && supabase) {
      try {
        const { data, error } = await supabase
          .from('comments')
          .insert({
            board_id: boardId,
            card_id: params.cardId || null,
            x: params.x,
            y: params.y,
            author_id: params.authorId || null,
            author_name: params.authorName,
            author_avatar: params.authorAvatar || null,
            body: params.body.trim(),
          })
          .select()
          .single();

        if (!error && data) {
          newComment.id = String(data.id);
        }
      } catch {}
    }

    // Process @mentions and notify mentioned teammates
    await this.notifyMentions(boardId, newComment);

    return newComment;
  },

  /**
   * Adds a reply to an existing comment thread.
   */
  async addReply(boardId: string, parentCommentId: string, params: CreateReplyParams): Promise<CommentItem> {
    const now = new Date().toISOString();
    const replyId = `reply_${Math.random().toString(36).slice(2, 10)}`;

    const newReply: CommentItem = {
      id: replyId,
      boardId,
      x: 0,
      y: 0,
      authorId: params.authorId || null,
      authorName: params.authorName || 'Collaborator',
      authorAvatar: params.authorAvatar || null,
      body: params.body.trim(),
      parentCommentId,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    };

    // Save locally
    const local = getLocalComments(boardId);
    local.push(newReply);
    saveLocalComments(boardId, local);

    // Save to Supabase Cloud if available
    if (!boardId.startsWith('board-') && supabase) {
      try {
        const { data, error } = await supabase
          .from('comments')
          .insert({
            board_id: boardId,
            parent_comment_id: parentCommentId,
            author_id: params.authorId || null,
            author_name: params.authorName,
            author_avatar: params.authorAvatar || null,
            body: params.body.trim(),
          })
          .select()
          .single();

        if (!error && data) {
          newReply.id = String(data.id);
        }
      } catch {}
    }

    // Notify parent thread author and mentioned users
    const parent = local.find(c => c.id === parentCommentId);
    if (parent && parent.authorId && parent.authorId !== params.authorId) {
      await notificationService.createNotification({
        userId: parent.authorId,
        type: 'reply',
        title: `${params.authorName} replied to your comment`,
        body: params.body.trim(),
        boardId,
        commentId: parentCommentId,
        cardId: parent.cardId,
        x: parent.x,
        y: parent.y,
      });
    }

    await this.notifyMentions(boardId, newReply, parent);

    return newReply;
  },

  /**
   * Toggles the resolved status of a comment thread.
   */
  async resolveComment(boardId: string, commentId: string, resolved: boolean, resolverName?: string): Promise<void> {
    const now = resolved ? new Date().toISOString() : null;

    // Update locally
    const local = getLocalComments(boardId);
    const target = local.find(c => c.id === commentId);
    if (target) {
      target.resolved = resolved;
      target.resolvedAt = now;
      target.resolvedBy = resolverName || null;
      target.updatedAt = new Date().toISOString();
      saveLocalComments(boardId, local);
    }

    // Update Supabase Cloud if available
    if (!boardId.startsWith('board-') && supabase) {
      try {
        await supabase
          .from('comments')
          .update({
            resolved,
            resolved_at: now,
            updated_at: new Date().toISOString(),
          })
          .eq('id', commentId);
      } catch {}
    }

    // Notify original comment author if resolved
    if (target && resolved && target.authorId) {
      await notificationService.createNotification({
        userId: target.authorId,
        type: 'comment_resolve',
        title: `${resolverName || 'A teammate'} resolved your comment`,
        body: target.body,
        boardId,
        commentId,
        cardId: target.cardId,
        x: target.x,
        y: target.y,
      });
    }
  },

  /**
   * Deletes a comment (and its replies).
   */
  async deleteComment(boardId: string, commentId: string): Promise<void> {
    const local = getLocalComments(boardId);
    const updated = local.filter(c => c.id !== commentId && c.parentCommentId !== commentId);
    saveLocalComments(boardId, updated);

    if (!boardId.startsWith('board-') && supabase) {
      try {
        await supabase.from('comments').delete().eq('id', commentId);
      } catch {}
    }
  },

  /**
   * Dispatches notifications to @mentioned users in comment text.
   */
  async notifyMentions(boardId: string, comment: CommentItem, parentComment?: CommentItem): Promise<void> {
    const mentions = this.extractMentions(comment.body);
    if (mentions.length === 0) return;

    try {
      const collaborators = await sharingService.getCollaborators(boardId);
      const coordX = parentComment ? parentComment.x : comment.x;
      const coordY = parentComment ? parentComment.y : comment.y;
      const cardId = parentComment ? parentComment.cardId : comment.cardId;

      for (const mention of mentions) {
        const user = collaborators.find(c => c.username.toLowerCase() === mention);
        if (user && user.userId && user.userId !== comment.authorId) {
          await notificationService.createNotification({
            userId: user.userId,
            type: 'mention',
            title: `${comment.authorName} mentioned you in a comment`,
            body: comment.body,
            boardId,
            commentId: comment.parentCommentId || comment.id,
            cardId,
            x: coordX,
            y: coordY,
          });
        }
      }
    } catch {}
  },
};
