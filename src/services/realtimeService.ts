import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { BoardState, Viewport } from '../types/board';

export interface PresenceUser {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  viewport?: Viewport | null;
  lastActive: number;
}

export interface BoardSyncMessage {
  senderId: string;
  state: BoardState;
  timestamp: number;
}

export interface CursorUpdateMessage {
  userId: string;
  cursor: { x: number; y: number } | null;
  viewport?: Viewport | null;
  timestamp: number;
}

export { COLLABORATOR_COLORS, getCollaboratorColor } from '../utils/realtimeColor';
import { getCollaboratorColor } from '../utils/realtimeColor';

type PresenceListener = (users: PresenceUser[]) => void;
type CursorListener = (cursor: CursorUpdateMessage) => void;
type BoardUpdateListener = (update: BoardSyncMessage) => void;
export type CommentUpdateListener = () => void;

class RealtimeService {
  private currentBoardId: string | null = null;
  private currentUser: PresenceUser | null = null;
  private supabaseChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private presenceListeners = new Set<PresenceListener>();
  private cursorListeners = new Set<CursorListener>();
  private boardUpdateListeners = new Set<BoardUpdateListener>();
  private commentListeners = new Set<CommentUpdateListener>();

  private activePresences = new Map<string, PresenceUser>();
  private lastCursorBroadcast = 0;
  private cursorThrottleMs = 35; // ~30 fps cursor broadcast
  private lastBoardSyncBroadcast = 0;
  private boardSyncThrottleMs = 150;

  public joinBoard(boardId: string, user: Omit<PresenceUser, 'color' | 'lastActive'>): void {
    if (this.currentBoardId === boardId && this.currentUser?.userId === user.userId) {
      return;
    }

    this.leaveBoard();
    this.currentBoardId = boardId;
    this.currentUser = {
      ...user,
      color: getCollaboratorColor(user.userId),
      lastActive: Date.now(),
    };

    // 1. Setup local browser BroadcastChannel (guarantees multi-tab sync locally even without Supabase cloud)
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(`visiospace-board-${boardId}`);
        this.broadcastChannel.onmessage = (e) => {
          this.handleBroadcastChannelMessage(e.data);
        };

        // Broadcast presence join to other tabs
        this.postToBroadcastChannel({
          type: 'presence_join',
          user: this.currentUser,
        });
      }
    } catch {
      // BroadcastChannel not available
    }

    // 2. Setup Supabase Realtime Channel if configured
    if (supabase && isSupabaseConfigured) {
      try {
        const channelName = `board:${boardId}`;
        this.supabaseChannel = supabase.channel(channelName, {
          config: {
            presence: { key: this.currentUser.userId },
            broadcast: { self: false },
          },
        });

        this.supabaseChannel
          .on('presence', { event: 'sync' }, () => {
            if (!this.supabaseChannel) return;
            const state = this.supabaseChannel.presenceState();
            this.handleSupabasePresenceSync(state);
          })
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            for (const p of newPresences as unknown as PresenceUser[]) {
              if (p.userId && p.userId !== this.currentUser?.userId) {
                this.activePresences.set(p.userId, p);
              }
            }
            this.notifyPresenceListeners();
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            for (const p of leftPresences as unknown as PresenceUser[]) {
              if (p.userId) {
                this.activePresences.delete(p.userId);
              }
            }
            this.notifyPresenceListeners();
          })
          .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
            this.handleRemoteCursor(payload as CursorUpdateMessage);
          })
          .on('broadcast', { event: 'board_sync' }, ({ payload }) => {
            this.handleRemoteBoardUpdate(payload as BoardSyncMessage);
          })
          .on('broadcast', { event: 'comment_update' }, () => {
            this.notifyCommentListeners();
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && this.supabaseChannel && this.currentUser) {
              await this.supabaseChannel.track(this.currentUser);
            }
          });
      } catch (err) {
        console.warn('[RealtimeService] Supabase Realtime subscription error:', err);
      }
    }
  }

  public leaveBoard(): void {
    if (this.currentBoardId && this.currentUser) {
      // Notify leave to BroadcastChannel
      this.postToBroadcastChannel({
        type: 'presence_leave',
        userId: this.currentUser.userId,
      });
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }

    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.unsubscribe();
      } catch {}
      this.supabaseChannel = null;
    }

    this.currentBoardId = null;
    this.currentUser = null;
    this.activePresences.clear();
    this.notifyPresenceListeners();
  }

  public broadcastCursor(cursor: { x: number; y: number } | null, viewport?: Viewport | null): void {
    if (!this.currentBoardId || !this.currentUser) return;

    const now = Date.now();
    if (cursor !== null && now - this.lastCursorBroadcast < this.cursorThrottleMs) {
      return;
    }
    this.lastCursorBroadcast = now;

    const message: CursorUpdateMessage = {
      userId: this.currentUser.userId,
      cursor,
      viewport,
      timestamp: now,
    };

    // Send via BroadcastChannel (local tabs)
    this.postToBroadcastChannel({
      type: 'cursor_move',
      message,
    });

    // Send via Supabase Realtime
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: message,
      }).catch(() => {});
    }
  }

  public broadcastBoardUpdate(state: BoardState): void {
    if (!this.currentBoardId || !this.currentUser) return;

    const now = Date.now();
    if (now - this.lastBoardSyncBroadcast < this.boardSyncThrottleMs) {
      return;
    }
    this.lastBoardSyncBroadcast = now;

    const message: BoardSyncMessage = {
      senderId: this.currentUser.userId,
      state,
      timestamp: now,
    };

    // Send via BroadcastChannel
    this.postToBroadcastChannel({
      type: 'board_sync',
      message,
    });

    // Send via Supabase Realtime
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'board_sync',
        payload: message,
      }).catch(() => {});
    }
  }

  // ─── Event Subscriptions ─────────────────────────────────────────

  public onPresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    listener(Array.from(this.activePresences.values()));
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  public onCursor(listener: CursorListener): () => void {
    this.cursorListeners.add(listener);
    return () => {
      this.cursorListeners.delete(listener);
    };
  }

  public onBoardUpdate(listener: BoardUpdateListener): () => void {
    this.boardUpdateListeners.add(listener);
    return () => {
      this.boardUpdateListeners.delete(listener);
    };
  }

  public broadcastCommentUpdate(): void {
    if (!this.currentBoardId) return;

    this.postToBroadcastChannel({
      type: 'comment_update',
      timestamp: Date.now(),
    });

    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'comment_update',
        payload: { timestamp: Date.now() },
      }).catch(() => {});
    }
  }

  public onCommentUpdate(listener: CommentUpdateListener): () => void {
    this.commentListeners.add(listener);
    return () => {
      this.commentListeners.delete(listener);
    };
  }

  private notifyCommentListeners(): void {
    this.commentListeners.forEach((fn) => fn());
  }

  public getActivePresences(): PresenceUser[] {
    return Array.from(this.activePresences.values());
  }

  public getCurrentUser(): PresenceUser | null {
    return this.currentUser;
  }

  // ─── Internal Handlers ───────────────────────────────────────────

  private notifyPresenceListeners(): void {
    const list = Array.from(this.activePresences.values());
    this.presenceListeners.forEach((fn) => fn(list));
  }

  private handleRemoteCursor(message: CursorUpdateMessage): void {
    if (message.userId === this.currentUser?.userId) return;

    const existing = this.activePresences.get(message.userId);
    if (existing) {
      existing.cursor = message.cursor;
      if (message.viewport) existing.viewport = message.viewport;
      existing.lastActive = Date.now();
    }

    this.cursorListeners.forEach((fn) => fn(message));
  }

  private handleRemoteBoardUpdate(message: BoardSyncMessage): void {
    if (message.senderId === this.currentUser?.userId) return;
    this.boardUpdateListeners.forEach((fn) => fn(message));
  }

  private handleSupabasePresenceSync(state: Record<string, unknown[]>): void {
    for (const key of Object.keys(state)) {
      if (key === this.currentUser?.userId) continue;
      const entries = state[key] as unknown as PresenceUser[];
      if (entries && entries.length > 0) {
        const p = entries[entries.length - 1];
        if (p.userId) {
          this.activePresences.set(p.userId, {
            ...p,
            color: p.color || getCollaboratorColor(p.userId),
          });
        }
      }
    }
    this.notifyPresenceListeners();
  }

  private handleBroadcastChannelMessage(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'presence_join': {
        const u = data.user as PresenceUser;
        if (u && u.userId !== this.currentUser?.userId) {
          this.activePresences.set(u.userId, u);
          this.notifyPresenceListeners();

          // Reply with our own presence so the new peer learns about us
          if (this.currentUser) {
            this.postToBroadcastChannel({
              type: 'presence_heartbeat',
              user: this.currentUser,
            });
          }
        }
        break;
      }
      case 'presence_heartbeat': {
        const u = data.user as PresenceUser;
        if (u && u.userId !== this.currentUser?.userId) {
          this.activePresences.set(u.userId, u);
          this.notifyPresenceListeners();
        }
        break;
      }
      case 'presence_leave': {
        const userId = String(data.userId);
        if (this.activePresences.has(userId)) {
          this.activePresences.delete(userId);
          this.notifyPresenceListeners();
        }
        break;
      }
      case 'cursor_move': {
        const msg = data.message as CursorUpdateMessage;
        if (msg) this.handleRemoteCursor(msg);
        break;
      }
      case 'board_sync': {
        const msg = data.message as BoardSyncMessage;
        if (msg) this.handleRemoteBoardUpdate(msg);
        break;
      }
      case 'comment_update': {
        this.notifyCommentListeners();
        break;
      }
    }
  }

  private postToBroadcastChannel(msg: unknown): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {}
    }
  }
}

export const realtimeService = new RealtimeService();
