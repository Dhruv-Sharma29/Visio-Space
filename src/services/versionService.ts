import { supabase } from '../lib/supabase.ts';
import type { BoardSnapshot, BoardState } from '../types/board.ts';

const LOCAL_SNAPSHOTS_PREFIX = 'visiospace_snapshots_';

function getLocalSnapshots(boardId: string): BoardSnapshot[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_SNAPSHOTS_PREFIX}${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalSnapshots(boardId: string, snapshots: BoardSnapshot[]) {
  try {
    localStorage.setItem(`${LOCAL_SNAPSHOTS_PREFIX}${boardId}`, JSON.stringify(snapshots));
  } catch {}
}

export const versionService = {
  /**
   * Retrieves all saved snapshots for a board, sorted newest first.
   */
  async getSnapshots(boardId: string): Promise<BoardSnapshot[]> {
    if (!boardId) return [];

    if (boardId.startsWith('board-') || !supabase) {
      return getLocalSnapshots(boardId);
    }

    try {
      const { data, error } = await supabase
        .from('board_snapshots')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return getLocalSnapshots(boardId);
      }

      const snapshots: BoardSnapshot[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        boardId: String(row.board_id),
        name: String(row.name || 'Untitled Snapshot'),
        description: row.description ? String(row.description) : undefined,
        state: (row.state as BoardState) || {
          cards: [],
          shapes: [],
          connectors: [],
          clusters: [],
          textItems: [],
          voteDots: [],
          images: [],
        },
        createdBy: row.created_by ? String(row.created_by) : null,
        createdByName: String(row.created_by_name || 'Collaborator'),
        createdAt: String(row.created_at),
        itemCount: (row.item_count as BoardSnapshot['itemCount']) || {
          cards: 0,
          shapes: 0,
          clusters: 0,
        },
      }));

      saveLocalSnapshots(boardId, snapshots);
      return snapshots;
    } catch {
      return getLocalSnapshots(boardId);
    }
  },

  /**
   * Creates a new snapshot of the current board state.
   */
  async createSnapshot(
    boardId: string,
    name: string,
    state: BoardState,
    user?: { id?: string | null; name?: string }
  ): Promise<BoardSnapshot> {
    const now = new Date().toISOString();
    const id = `snap_${Math.random().toString(36).slice(2, 10)}`;

    const itemCount = {
      cards: state.cards?.length || 0,
      shapes: state.shapes?.length || 0,
      clusters: state.clusters?.length || 0,
    };

    const newSnapshot: BoardSnapshot = {
      id,
      boardId,
      name: name.trim() || `Version ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      state: JSON.parse(JSON.stringify(state)),
      createdBy: user?.id || null,
      createdByName: user?.name || 'Collaborator',
      createdAt: now,
      itemCount,
    };

    // Save locally
    const local = getLocalSnapshots(boardId);
    local.unshift(newSnapshot);
    saveLocalSnapshots(boardId, local);

    // Save to Supabase Cloud if available
    if (!boardId.startsWith('board-') && supabase) {
      try {
        const { data, error } = await supabase
          .from('board_snapshots')
          .insert({
            board_id: boardId,
            name: newSnapshot.name,
            state: newSnapshot.state,
            created_by: newSnapshot.createdBy,
            created_by_name: newSnapshot.createdByName,
            item_count: newSnapshot.itemCount,
          })
          .select()
          .single();

        if (!error && data) {
          newSnapshot.id = String(data.id);
        }
      } catch {}
    }

    return newSnapshot;
  },

  /**
   * Restores a snapshot. Automatically captures a backup of currentState first!
   */
  async restoreSnapshot(
    boardId: string,
    snapshotId: string,
    currentState: BoardState,
    user?: { id?: string | null; name?: string }
  ): Promise<BoardState | null> {
    const snapshots = await this.getSnapshots(boardId);
    const target = snapshots.find(s => s.id === snapshotId);
    if (!target) return null;

    // Safety guarantee: Create an automatic backup snapshot of currentState before rolling back
    await this.createSnapshot(
      boardId,
      `Backup before restoring "${target.name}"`,
      currentState,
      user
    );

    return JSON.parse(JSON.stringify(target.state));
  },

  /**
   * Deletes a snapshot from history.
   */
  async deleteSnapshot(boardId: string, snapshotId: string): Promise<boolean> {
    const local = getLocalSnapshots(boardId).filter(s => s.id !== snapshotId);
    saveLocalSnapshots(boardId, local);

    if (!boardId.startsWith('board-') && supabase) {
      try {
        await supabase
          .from('board_snapshots')
          .delete()
          .eq('id', snapshotId);
      } catch {}
    }

    return true;
  },
};
