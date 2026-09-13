import { supabase } from '../lib/supabase';

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: 'owner' | 'admin' | 'member';
}

const LOCAL_WORKSPACES_KEY = 'visiospace_workspaces';

function getLocalWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(LOCAL_WORKSPACES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const defaultWs: Workspace = {
    id: 'local-default-ws',
    name: 'Personal Workspace',
    created_by: 'guest',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'owner',
  };
  try {
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify([defaultWs]));
  } catch {}
  return [defaultWs];
}

function saveLocalWorkspaces(workspaces: Workspace[]) {
  try {
    localStorage.setItem(LOCAL_WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {}
}

export const workspaceService = {
  async getMyWorkspaces(userId?: string | null): Promise<Workspace[]> {
    if (!supabase || !userId) {
      return getLocalWorkspaces();
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*, workspace_members(role)')
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        if (error && (error.code === 'PGRST205' || error.message.includes('relation'))) {
          return getLocalWorkspaces();
        }
        return await workspaceService.ensureDefaultWorkspace(userId);
      }

      return data.map((ws: Record<string, unknown>) => {
        const members = Array.isArray(ws.workspace_members) ? ws.workspace_members : [];
        return {
          id: String(ws.id),
          name: String(ws.name),
          created_by: String(ws.created_by),
          created_at: String(ws.created_at),
          updated_at: String(ws.updated_at),
          role: (members[0]?.role as 'owner' | 'admin' | 'member') || 'owner',
        };
      });
    } catch {
      return getLocalWorkspaces();
    }
  },

  async ensureDefaultWorkspace(userId: string): Promise<Workspace[]> {
    if (!supabase) return getLocalWorkspaces();

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name: 'Personal Workspace', created_by: userId })
        .select()
        .single();

      if (error || !data) {
        return getLocalWorkspaces();
      }

      return [{
        id: data.id,
        name: data.name,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        role: 'owner',
      }];
    } catch {
      return getLocalWorkspaces();
    }
  },

  async createWorkspace(name: string, userId?: string | null): Promise<Workspace> {
    if (!supabase || !userId) {
      const workspaces = getLocalWorkspaces();
      const newWs: Workspace = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        created_by: userId || 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'owner',
      };
      workspaces.push(newWs);
      saveLocalWorkspaces(workspaces);
      return newWs;
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name, created_by: userId })
        .select()
        .single();

      if (error || !data) {
        if (error?.code === 'PGRST205') {
          return this.createWorkspace(name, null);
        }
        throw new Error(error?.message || 'Failed to create workspace');
      }

      return {
        id: data.id,
        name: data.name,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
        role: 'owner',
      };
    } catch {
      return this.createWorkspace(name, null);
    }
  },
};
