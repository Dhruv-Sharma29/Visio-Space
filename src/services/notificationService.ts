import { supabase } from '../lib/supabase.ts';
import type { InAppNotification } from '../types/board.ts';

const LOCAL_NOTIFS_PREFIX = 'visiospace_notifications_';

function getLocalNotifications(userId: string): InAppNotification[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIFS_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalNotifications(userId: string, notifs: InAppNotification[]) {
  try {
    localStorage.setItem(`${LOCAL_NOTIFS_PREFIX}${userId}`, JSON.stringify(notifs));
  } catch {}
}

export const notificationService = {
  /**
   * Retrieves all notifications for a given user, sorted newest first.
   */
  async getNotifications(userId: string): Promise<InAppNotification[]> {
    if (!userId) return [];

    if (!supabase || userId.startsWith('guest_') || userId.startsWith('local_')) {
      return getLocalNotifications(userId);
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return getLocalNotifications(userId);
      }

      const notifs: InAppNotification[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.user_id),
        type: (row.type as InAppNotification['type']) || 'mention',
        title: String(row.title || 'Notification'),
        body: String(row.body || ''),
        boardId: String(row.board_id),
        commentId: row.comment_id ? String(row.comment_id) : null,
        cardId: row.card_id ? String(row.card_id) : null,
        x: row.x != null ? Number(row.x) : undefined,
        y: row.y != null ? Number(row.y) : undefined,
        read: Boolean(row.read),
        createdAt: String(row.created_at),
      }));

      saveLocalNotifications(userId, notifs);
      return notifs;
    } catch {
      return getLocalNotifications(userId);
    }
  },

  /**
   * Creates and stores a new in-app notification for a user.
   */
  async createNotification(
    params: Omit<InAppNotification, 'id' | 'createdAt' | 'read'>
  ): Promise<InAppNotification> {
    const now = new Date().toISOString();
    const id = `notif_${Math.random().toString(36).slice(2, 10)}`;

    const newNotif: InAppNotification = {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      boardId: params.boardId,
      commentId: params.commentId || null,
      cardId: params.cardId || null,
      x: params.x,
      y: params.y,
      read: false,
      createdAt: now,
    };

    // Save locally
    const local = getLocalNotifications(params.userId);
    local.unshift(newNotif);
    saveLocalNotifications(params.userId, local);

    // Save to Supabase Cloud if available
    if (supabase && !params.userId.startsWith('guest_') && !params.userId.startsWith('local_')) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert({
            user_id: params.userId,
            type: params.type,
            title: params.title,
            body: params.body,
            board_id: params.boardId,
            comment_id: params.commentId || null,
            card_id: params.cardId || null,
            x: params.x,
            y: params.y,
          })
          .select()
          .single();

        if (!error && data) {
          newNotif.id = String(data.id);
        }
      } catch {}
    }

    return newNotif;
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const local = getLocalNotifications(userId);
    const target = local.find(n => n.id === notificationId);
    if (target) {
      target.read = true;
      saveLocalNotifications(userId, local);
    }

    if (supabase && !userId.startsWith('guest_') && !userId.startsWith('local_')) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', userId);
      } catch {}
    }
  },

  /**
   * Marks all notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<void> {
    const local = getLocalNotifications(userId);
    local.forEach(n => {
      n.read = true;
    });
    saveLocalNotifications(userId, local);

    if (supabase && !userId.startsWith('guest_') && !userId.startsWith('local_')) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId);
      } catch {}
    }
  },

  /**
   * Returns the count of unread notifications for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifs = await this.getNotifications(userId);
    return notifs.filter(n => !n.read).length;
  },

  /**
   * Deletes a notification.
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const local = getLocalNotifications(userId).filter(n => n.id !== notificationId);
    saveLocalNotifications(userId, local);

    if (supabase && !userId.startsWith('guest_') && !userId.startsWith('local_')) {
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId)
          .eq('user_id', userId);
      } catch {}
    }
  },
};
