import { supabase } from '../lib/supabase';
import type { BoardState } from '../types/board';
import { normalizeBoardState } from '../utils/boardValidation';

export interface BoardSummary {
  id: string;
  workspace_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  cardCount: number;
  shapeCount: number;
  connectorCount: number;
  clusterCount: number;
}

const LOCAL_BOARDS_KEY = 'visiospace_boards_list';
const LOCAL_BOARD_DATA_PREFIX = 'visiospace_board_data_';

function getLocalBoardsList(): BoardSummary[] {
  try {
    const raw = localStorage.getItem(LOCAL_BOARDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalBoardsList(boards: BoardSummary[]) {
  try {
    localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
  } catch {}
}

export const boardService = {
  async listBoards(workspaceId: string, userId?: string | null): Promise<BoardSummary[]> {
    if (!supabase || !userId) {
      const local = getLocalBoardsList();
      return local.filter(b => b.workspace_id === workspaceId);
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, workspace_id, title, state, thumbnail_url, created_by, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('relation')) {
          return getLocalBoardsList().filter(b => b.workspace_id === workspaceId);
        }
        throw new Error(error.message);
      }

      return (data || []).map((b: Record<string, unknown>) => {
        const state = b.state as BoardState;
        return {
          id: String(b.id),
          workspace_id: String(b.workspace_id),
          title: String(b.title),
          created_by: String(b.created_by),
          created_at: String(b.created_at),
          updated_at: String(b.updated_at),
          thumbnail_url: b.thumbnail_url ? String(b.thumbnail_url) : null,
          cardCount: state?.cards?.length || 0,
          shapeCount: state?.shapes?.length || 0,
          connectorCount: state?.connectors?.length || 0,
          clusterCount: state?.clusters?.length || 0,
        };
      });
    } catch {
      return getLocalBoardsList().filter(b => b.workspace_id === workspaceId);
    }
  },

  async createBoard(
    workspaceId: string,
    title = 'Untitled Board',
    initialState?: BoardState,
    userId?: string | null,
  ): Promise<BoardSummary> {
    const state = initialState || {
      cards: [],
      shapes: [],
      connectors: [],
      clusters: [],
      textItems: [],
      voteDots: [],
      images: [],
    };

    if (!supabase || !userId) {
      const newId = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const summary: BoardSummary = {
        id: newId,
        workspace_id: workspaceId,
        title,
        created_by: userId || 'guest',
        created_at: now,
        updated_at: now,
        cardCount: state.cards.length,
        shapeCount: state.shapes.length,
        connectorCount: state.connectors.length,
        clusterCount: state.clusters.length,
      };

      const boards = getLocalBoardsList();
      boards.unshift(summary);
      saveLocalBoardsList(boards);
      try {
        localStorage.setItem(`${LOCAL_BOARD_DATA_PREFIX}${newId}`, JSON.stringify(state));
      } catch {}
      return summary;
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .insert({
          workspace_id: workspaceId,
          title,
          state,
          created_by: userId,
        })
        .select()
        .single();

      if (error || !data) {
        if (error?.code === 'PGRST205' || error?.message?.includes('relation')) {
          return this.createBoard(workspaceId, title, initialState, null);
        }
        throw new Error(error?.message || 'Failed to create board');
      }

      return {
        id: data.id,
        workspace_id: data.workspace_id,
        title: data.title,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        cardCount: state.cards.length,
        shapeCount: state.shapes.length,
        connectorCount: state.connectors.length,
        clusterCount: state.clusters.length,
      };
    } catch {
      return this.createBoard(workspaceId, title, initialState, null);
    }
  },

  async getBoard(boardId: string): Promise<{ summary: BoardSummary; state: BoardState }> {
    if (boardId.startsWith('board-') || !supabase) {
      const raw = localStorage.getItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`);
      const state = raw ? normalizeBoardState(JSON.parse(raw)) : { cards: [], shapes: [], connectors: [], clusters: [] };
      const summary = getLocalBoardsList().find(b => b.id === boardId) || {
        id: boardId,
        workspace_id: 'local-default-ws',
        title: 'Untitled Board',
        created_by: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cardCount: state.cards.length,
        shapeCount: state.shapes.length,
        connectorCount: state.connectors.length,
        clusterCount: state.clusters.length,
      };
      return { summary, state };
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Board not found');
      }

      const state = normalizeBoardState(data.state);
      return {
        summary: {
          id: data.id,
          workspace_id: data.workspace_id,
          title: data.title,
          created_by: data.created_by,
          created_at: data.created_at,
          updated_at: data.updated_at,
          thumbnail_url: data.thumbnail_url,
          cardCount: state.cards.length,
          shapeCount: state.shapes.length,
          connectorCount: state.connectors.length,
          clusterCount: state.clusters.length,
        },
        state,
      };
    } catch {
      const raw = localStorage.getItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`);
      const state = raw ? normalizeBoardState(JSON.parse(raw)) : { cards: [], shapes: [], connectors: [], clusters: [] };
      return {
        summary: {
          id: boardId,
          workspace_id: 'local-default-ws',
          title: 'Board',
          created_by: 'guest',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cardCount: state.cards.length,
          shapeCount: state.shapes.length,
          connectorCount: state.connectors.length,
          clusterCount: state.clusters.length,
        },
        state,
      };
    }
  },

  async saveBoardState(boardId: string, state: BoardState): Promise<void> {
    const safeState = normalizeBoardState(state);

    if (boardId.startsWith('board-') || !supabase) {
      try {
        localStorage.setItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`, JSON.stringify(safeState));
      } catch {}
      const boards = getLocalBoardsList();
      const idx = boards.findIndex(b => b.id === boardId);
      if (idx >= 0) {
        boards[idx].updated_at = new Date().toISOString();
        boards[idx].cardCount = safeState.cards.length;
        boards[idx].shapeCount = safeState.shapes.length;
        boards[idx].connectorCount = safeState.connectors.length;
        boards[idx].clusterCount = safeState.clusters.length;
        saveLocalBoardsList(boards);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('boards')
        .update({
          state: safeState,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boardId);

      if (error) {
        localStorage.setItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`, JSON.stringify(safeState));
      }
    } catch {
      localStorage.setItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`, JSON.stringify(safeState));
    }
  },

  async renameBoard(boardId: string, title: string): Promise<void> {
    if (boardId.startsWith('board-') || !supabase) {
      const boards = getLocalBoardsList();
      const found = boards.find(b => b.id === boardId);
      if (found) {
        found.title = title;
        found.updated_at = new Date().toISOString();
        saveLocalBoardsList(boards);
      }
      return;
    }

    try {
      await supabase
        .from('boards')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', boardId);
    } catch {
      const boards = getLocalBoardsList();
      const found = boards.find(b => b.id === boardId);
      if (found) {
        found.title = title;
        found.updated_at = new Date().toISOString();
        saveLocalBoardsList(boards);
      }
    }
  },

  async deleteBoard(boardId: string): Promise<void> {
    if (boardId.startsWith('board-') || !supabase) {
      const boards = getLocalBoardsList().filter(b => b.id !== boardId);
      saveLocalBoardsList(boards);
      localStorage.removeItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`);
      return;
    }

    try {
      await supabase.from('boards').delete().eq('id', boardId);
    } catch {
      const boards = getLocalBoardsList().filter(b => b.id !== boardId);
      saveLocalBoardsList(boards);
      localStorage.removeItem(`${LOCAL_BOARD_DATA_PREFIX}${boardId}`);
    }
  },

  async duplicateBoard(boardId: string, userId?: string | null): Promise<BoardSummary> {
    const { summary, state } = await this.getBoard(boardId);
    return this.createBoard(
      summary.workspace_id,
      `${summary.title} (Copy)`,
      state,
      userId,
    );
  },
};
