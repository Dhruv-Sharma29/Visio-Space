import { supabase } from '../lib/supabase.ts';
import type { BoardCollaborator, BoardRole, BoardShareSettings, PublicAccessLevel } from '../types/board.ts';

const LOCAL_SHARE_PREFIX = 'visiospace_share_config_';
const LOCAL_COLLABORATORS_PREFIX = 'visiospace_board_collaborators_';

function getLocalShareConfig(boardId: string): { publicAccess: PublicAccessLevel; shareToken: string } {
  try {
    const raw = localStorage.getItem(`${LOCAL_SHARE_PREFIX}${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Generate a random 12-char token
  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const config = { publicAccess: 'private' as PublicAccessLevel, shareToken: token };
  try {
    localStorage.setItem(`${LOCAL_SHARE_PREFIX}${boardId}`, JSON.stringify(config));
  } catch {}
  return config;
}

function saveLocalShareConfig(boardId: string, config: { publicAccess: PublicAccessLevel; shareToken: string }) {
  try {
    localStorage.setItem(`${LOCAL_SHARE_PREFIX}${boardId}`, JSON.stringify(config));
  } catch {}
}

function getLocalCollaborators(boardId: string): BoardCollaborator[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_COLLABORATORS_PREFIX}${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalCollaborators(boardId: string, list: BoardCollaborator[]) {
  try {
    localStorage.setItem(`${LOCAL_COLLABORATORS_PREFIX}${boardId}`, JSON.stringify(list));
  } catch {}
}

export const sharingService = {
  /**
   * Generates a fully qualified share link for the given board and token.
   */
  buildShareUrl(boardId: string, token: string, access: PublicAccessLevel): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    const roleParam = access === 'editor' ? 'editor' : 'viewer';
    return `${origin}${path}#board/${boardId}?token=${token}&role=${roleParam}`;
  },

  /**
   * Fetches share settings (public access, share token, share URL) for a board.
   */
  async getShareSettings(boardId: string): Promise<BoardShareSettings> {
    if (boardId.startsWith('board-') || !supabase) {
      const local = getLocalShareConfig(boardId);
      return {
        boardId,
        publicAccess: local.publicAccess,
        shareToken: local.shareToken,
        shareUrl: this.buildShareUrl(boardId, local.shareToken, local.publicAccess),
      };
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .select('id, share_token, public_access')
        .eq('id', boardId)
        .single();

      if (error || !data) {
        const local = getLocalShareConfig(boardId);
        return {
          boardId,
          publicAccess: local.publicAccess,
          shareToken: local.shareToken,
          shareUrl: this.buildShareUrl(boardId, local.shareToken, local.publicAccess),
        };
      }

      let shareToken = data.share_token;
      let publicAccess = (data.public_access || 'private') as PublicAccessLevel;

      // If no token exists on this board yet, generate and save one
      if (!shareToken) {
        shareToken = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
        await supabase
          .from('boards')
          .update({ share_token: shareToken })
          .eq('id', boardId);
      }

      return {
        boardId,
        publicAccess,
        shareToken,
        shareUrl: this.buildShareUrl(boardId, shareToken, publicAccess),
      };
    } catch {
      const local = getLocalShareConfig(boardId);
      return {
        boardId,
        publicAccess: local.publicAccess,
        shareToken: local.shareToken,
        shareUrl: this.buildShareUrl(boardId, local.shareToken, local.publicAccess),
      };
    }
  },

  /**
   * Updates the public link access level ('private' | 'viewer' | 'editor')
   */
  async updatePublicAccess(boardId: string, publicAccess: PublicAccessLevel): Promise<void> {
    if (boardId.startsWith('board-') || !supabase) {
      const current = getLocalShareConfig(boardId);
      saveLocalShareConfig(boardId, { ...current, publicAccess });
      return;
    }

    try {
      const { error } = await supabase
        .from('boards')
        .update({ public_access: publicAccess })
        .eq('id', boardId);

      if (error) {
        const current = getLocalShareConfig(boardId);
        saveLocalShareConfig(boardId, { ...current, publicAccess });
      }
    } catch {
      const current = getLocalShareConfig(boardId);
      saveLocalShareConfig(boardId, { ...current, publicAccess });
    }
  },

  /**
   * Retrieves all collaborators on a board (Owner + Editors + Viewers)
   */
  async getCollaborators(boardId: string, currentUserId?: string | null): Promise<BoardCollaborator[]> {
    if (boardId.startsWith('board-') || !supabase) {
      const list = getLocalCollaborators(boardId);
      if (list.length === 0) {
        // Provide current user as initial owner
        const defaultOwner: BoardCollaborator = {
          userId: currentUserId || 'guest',
          username: 'you',
          fullName: 'Board Owner',
          role: 'owner',
          joinedAt: new Date().toISOString(),
        };
        saveLocalCollaborators(boardId, [defaultOwner]);
        return [defaultOwner];
      }
      return list;
    }

    try {
      const { data, error } = await supabase.rpc('get_board_collaborators', {
        target_board_id: boardId,
      });

      if (error || !data || !Array.isArray(data)) {
        // Fallback: direct table queries
        const { data: boardData } = await supabase
          .from('boards')
          .select('created_by, created_at')
          .eq('id', boardId)
          .single();

        const { data: membersData } = await supabase
          .from('board_members')
          .select('user_id, role, created_at')
          .eq('board_id', boardId);

        const allUserIds = [
          ...(boardData ? [boardData.created_by] : []),
          ...(membersData ? membersData.map((m: Record<string, unknown>) => m.user_id as string) : []),
        ];

        let profilesMap: Record<string, { username: string; full_name: string; avatar_url: string | null }> = {};
        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', allUserIds);

          if (profiles) {
            profilesMap = Object.fromEntries(
              profiles.map((p: Record<string, unknown>) => [
                p.id as string,
                {
                  username: (p.username as string) || 'collaborator',
                  full_name: (p.full_name as string) || 'Collaborator',
                  avatar_url: (p.avatar_url as string) || null,
                },
              ])
            );
          }
        }

        const result: BoardCollaborator[] = [];
        if (boardData) {
          const ownerProfile = profilesMap[boardData.created_by] || {
            username: 'owner',
            full_name: 'Board Owner',
            avatar_url: null,
          };
          result.push({
            userId: boardData.created_by,
            username: ownerProfile.username,
            fullName: ownerProfile.full_name,
            avatarUrl: ownerProfile.avatar_url,
            role: 'owner',
            joinedAt: boardData.created_at,
          });
        }

        if (membersData) {
          for (const m of membersData as Array<Record<string, unknown>>) {
            const uid = m.user_id as string;
            if (boardData && uid === boardData.created_by) continue;
            const p = profilesMap[uid] || {
              username: 'member',
              fullName: 'Collaborator',
              avatar_url: null,
            };
            result.push({
              userId: uid,
              username: p.username,
              fullName: (p as { full_name?: string }).full_name || 'Collaborator',
              avatarUrl: p.avatar_url,
              role: (m.role as BoardRole) || 'editor',
              joinedAt: m.created_at as string,
            });
          }
        }

        return result;
      }

      return data.map((item: Record<string, unknown>) => ({
        userId: String(item.user_id),
        username: String(item.username || 'collaborator'),
        fullName: String(item.full_name || 'Collaborator'),
        avatarUrl: item.avatar_url ? String(item.avatar_url) : null,
        role: (item.role as BoardRole) || 'viewer',
        joinedAt: item.joined_at ? String(item.joined_at) : undefined,
      }));
    } catch {
      return getLocalCollaborators(boardId);
    }
  },

  /**
   * Invites a collaborator by @username or email.
   */
  async inviteCollaborator(
    boardId: string,
    identifier: string,
    role: BoardRole
  ): Promise<{ success: boolean; error?: string; collaborator?: BoardCollaborator }> {
    const cleanIdentifier = identifier.trim().replace(/^@/, '');
    if (!cleanIdentifier) {
      return { success: false, error: 'Please enter a valid username' };
    }

    if (boardId.startsWith('board-') || !supabase) {
      const currentList = getLocalCollaborators(boardId);
      if (currentList.some(c => c.username.toLowerCase() === cleanIdentifier.toLowerCase())) {
        return { success: false, error: `@${cleanIdentifier} is already a collaborator on this board` };
      }

      const newMember: BoardCollaborator = {
        userId: `local_user_${Math.random().toString(36).slice(2, 8)}`,
        username: cleanIdentifier,
        fullName: `@${cleanIdentifier}`,
        avatarUrl: null,
        role,
        joinedAt: new Date().toISOString(),
      };

      currentList.push(newMember);
      saveLocalCollaborators(boardId, currentList);
      return { success: true, collaborator: newMember };
    }

    try {
      const { data, error } = await supabase.rpc('invite_board_collaborator', {
        target_board_id: boardId,
        target_username: cleanIdentifier,
        target_role: role,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success: boolean; error?: string; userId?: string };
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to invite user' };
      }

      const collaborators = await this.getCollaborators(boardId);
      const added = collaborators.find(c => c.username.toLowerCase() === cleanIdentifier.toLowerCase());

      return { success: true, collaborator: added };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to invite collaborator',
      };
    }
  },

  /**
   * Updates an existing collaborator's role ('editor' or 'viewer').
   */
  async updateCollaboratorRole(boardId: string, userId: string, newRole: BoardRole): Promise<void> {
    if (boardId.startsWith('board-') || !supabase) {
      const list = getLocalCollaborators(boardId);
      const target = list.find(c => c.userId === userId);
      if (target) {
        target.role = newRole;
        saveLocalCollaborators(boardId, list);
      }
      return;
    }

    try {
      const { error } = await supabase.rpc('update_board_collaborator_role', {
        target_board_id: boardId,
        target_user_id: userId,
        new_role: newRole,
      });

      if (error) {
        // Direct update fallback
        await supabase
          .from('board_members')
          .update({ role: newRole })
          .eq('board_id', boardId)
          .eq('user_id', userId);
      }
    } catch {
      const list = getLocalCollaborators(boardId);
      const target = list.find(c => c.userId === userId);
      if (target) {
        target.role = newRole;
        saveLocalCollaborators(boardId, list);
      }
    }
  },

  /**
   * Removes a collaborator from the board.
   */
  async removeCollaborator(boardId: string, userId: string): Promise<void> {
    if (boardId.startsWith('board-') || !supabase) {
      const list = getLocalCollaborators(boardId).filter(c => c.userId !== userId);
      saveLocalCollaborators(boardId, list);
      return;
    }

    try {
      const { error } = await supabase.rpc('remove_board_collaborator', {
        target_board_id: boardId,
        target_user_id: userId,
      });

      if (error) {
        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', boardId)
          .eq('user_id', userId);
      }
    } catch {
      const list = getLocalCollaborators(boardId).filter(c => c.userId !== userId);
      saveLocalCollaborators(boardId, list);
    }
  },

  /**
   * Resolves the user's role on the board: 'owner' | 'editor' | 'viewer'.
   */
  async resolveUserRole(
    boardId: string,
    userId?: string | null,
    shareToken?: string | null,
    queryRole?: string | null
  ): Promise<BoardRole> {
    // 1. Explicit query param override (e.g. ?role=viewer in share link)
    if (queryRole === 'viewer') return 'viewer';
    if (queryRole === 'editor' && !userId) {
      // Guest with editor link
      return 'editor';
    }

    // 2. Local board resolution
    if (boardId.startsWith('board-') || !supabase) {
      const collaborators = getLocalCollaborators(boardId);
      if (userId) {
        const found = collaborators.find(c => c.userId === userId);
        if (found) return found.role;
      }

      const localConfig = getLocalShareConfig(boardId);
      if (shareToken && shareToken === localConfig.shareToken) {
        return localConfig.publicAccess === 'editor' ? 'editor' : 'viewer';
      }

      if (localConfig.publicAccess === 'editor') return 'editor';
      if (localConfig.publicAccess === 'viewer') return 'viewer';

      // If board has existing collaborators and unknown user accesses without token, restrict to viewer
      if (collaborators.length > 0 && userId && !collaborators.some(c => c.userId === userId)) {
        return 'viewer';
      }

      return 'owner'; // Local creator is owner
    }

    // 3. Supabase Cloud resolution
    try {
      // Check RPC
      const { data: roleData, error: roleError } = await supabase.rpc('get_board_role', {
        target_board_id: boardId,
      });

      if (!roleError && roleData) {
        if (roleData === 'owner' || roleData === 'editor' || roleData === 'viewer') {
          return roleData as BoardRole;
        }
      }

      // Check board creator
      const { data: boardData } = await supabase
        .from('boards')
        .select('created_by, public_access, share_token')
        .eq('id', boardId)
        .single();

      if (boardData) {
        if (userId && boardData.created_by === userId) {
          return 'owner';
        }

        // Check explicit membership
        if (userId) {
          const { data: memberData } = await supabase
            .from('board_members')
            .select('role')
            .eq('board_id', boardId)
            .eq('user_id', userId)
            .maybeSingle();

          if (memberData?.role) {
            return memberData.role as BoardRole;
          }
        }

        // Check token or public access
        if (shareToken && boardData.share_token === shareToken) {
          return boardData.public_access === 'editor' ? 'editor' : 'viewer';
        }

        if (boardData.public_access === 'editor') return 'editor';
        if (boardData.public_access === 'viewer') return 'viewer';
      }

      return 'viewer';
    } catch {
      return queryRole === 'viewer' ? 'viewer' : 'editor';
    }
  },
};
