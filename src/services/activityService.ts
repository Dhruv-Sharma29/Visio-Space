import { supabase } from '../lib/supabase.ts';
import type { ActivityActionType, ActivityLogItem } from '../types/board.ts';

const LOCAL_ACTIVITY_PREFIX = 'visiospace_activity_';

function getLocalActivities(boardId: string): ActivityLogItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_ACTIVITY_PREFIX}${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalActivities(boardId: string, activities: ActivityLogItem[]) {
  try {
    // Keep last 100 activities locally
    localStorage.setItem(
      `${LOCAL_ACTIVITY_PREFIX}${boardId}`,
      JSON.stringify(activities.slice(0, 100))
    );
  } catch {}
}

export interface LogActivityParams {
  action: ActivityActionType;
  description: string;
  user?: {
    id?: string | null;
    name?: string;
    avatarUrl?: string | null;
  };
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Retrieves the activity log for a board, sorted newest first.
   */
  async getActivities(boardId: string): Promise<ActivityLogItem[]> {
    if (!boardId) return [];

    if (boardId.startsWith('board-') || !supabase) {
      return getLocalActivities(boardId);
    }

    try {
      const { data, error } = await supabase
        .from('board_activity')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        return getLocalActivities(boardId);
      }

      const activities: ActivityLogItem[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        boardId: String(row.board_id),
        userId: row.user_id ? String(row.user_id) : null,
        userName: String(row.user_name || 'Collaborator'),
        userAvatar: row.user_avatar ? String(row.user_avatar) : null,
        action: (row.action as ActivityActionType) || 'card_add',
        description: String(row.description || ''),
        metadata: (row.metadata as Record<string, unknown>) || {},
        createdAt: String(row.created_at),
      }));

      saveLocalActivities(boardId, activities);
      return activities;
    } catch {
      return getLocalActivities(boardId);
    }
  },

  /**
   * Logs a new activity event for the board.
   */
  async logActivity(boardId: string, params: LogActivityParams): Promise<ActivityLogItem> {
    const now = new Date().toISOString();
    const id = `act_${Math.random().toString(36).slice(2, 10)}`;

    const newActivity: ActivityLogItem = {
      id,
      boardId,
      userId: params.user?.id || null,
      userName: params.user?.name || 'Collaborator',
      userAvatar: params.user?.avatarUrl || null,
      action: params.action,
      description: params.description,
      metadata: params.metadata || {},
      createdAt: now,
    };

    // Save locally
    const local = getLocalActivities(boardId);
    local.unshift(newActivity);
    saveLocalActivities(boardId, local);

    // Save to Supabase Cloud if available
    if (!boardId.startsWith('board-') && supabase) {
      try {
        const { data, error } = await supabase
          .from('board_activity')
          .insert({
            board_id: boardId,
            user_id: newActivity.userId,
            user_name: newActivity.userName,
            user_avatar: newActivity.userAvatar,
            action: newActivity.action,
            description: newActivity.description,
            metadata: newActivity.metadata,
          })
          .select()
          .single();

        if (!error && data) {
          newActivity.id = String(data.id);
        }
      } catch {}
    }

    return newActivity;
  },
};
