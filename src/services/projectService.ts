import { supabase } from '../lib/supabase.ts';
import type { BoardProject } from '../types/board.ts';

const LOCAL_PROJECTS_PREFIX = 'visiospace_projects_';
const LOCAL_BOARDS_KEY = 'visiospace_boards_list';

function getLocalProjects(workspaceId: string): BoardProject[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_PROJECTS_PREFIX}${workspaceId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalProjects(workspaceId: string, projects: BoardProject[]) {
  try {
    localStorage.setItem(`${LOCAL_PROJECTS_PREFIX}${workspaceId}`, JSON.stringify(projects));
  } catch {}
}

export const projectService = {
  /**
   * Retrieves all projects/folders for a workspace.
   */
  async getProjects(workspaceId: string): Promise<BoardProject[]> {
    if (!workspaceId) return [];

    if (workspaceId.startsWith('local_') || !supabase) {
      return getLocalProjects(workspaceId);
    }

    try {
      const { data, error } = await supabase
        .from('board_projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return getLocalProjects(workspaceId);
      }

      const projects: BoardProject[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        name: String(row.name || 'Untitled Project'),
        color: String(row.color || '#d6a85f'),
        createdAt: String(row.created_at),
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      }));

      saveLocalProjects(workspaceId, projects);
      return projects;
    } catch {
      return getLocalProjects(workspaceId);
    }
  },

  /**
   * Creates a new project folder.
   */
  async createProject(workspaceId: string, name: string, color = '#d6a85f'): Promise<BoardProject> {
    const now = new Date().toISOString();
    const id = `proj_${Math.random().toString(36).slice(2, 10)}`;

    const newProject: BoardProject = {
      id,
      workspaceId,
      name: name.trim() || 'Untitled Project',
      color,
      createdAt: now,
      updatedAt: now,
    };

    // Save locally
    const local = getLocalProjects(workspaceId);
    local.push(newProject);
    saveLocalProjects(workspaceId, local);

    // Save to Supabase Cloud if available
    if (!workspaceId.startsWith('local_') && supabase) {
      try {
        const { data, error } = await supabase
          .from('board_projects')
          .insert({
            workspace_id: workspaceId,
            name: newProject.name,
            color: newProject.color,
          })
          .select()
          .single();

        if (!error && data) {
          newProject.id = String(data.id);
        }
      } catch {}
    }

    return newProject;
  },

  /**
   * Deletes a project. Does NOT delete boards inside it; unlinks them.
   */
  async deleteProject(workspaceId: string, projectId: string): Promise<boolean> {
    const local = getLocalProjects(workspaceId).filter(p => p.id !== projectId);
    saveLocalProjects(workspaceId, local);

    // Unlink any boards assigned to this project
    try {
      const raw = localStorage.getItem(LOCAL_BOARDS_KEY);
      if (raw) {
        const boards = JSON.parse(raw);
        boards.forEach((b: Record<string, unknown>) => {
          if (b.projectId === projectId || b.project_id === projectId) {
            b.projectId = null;
            b.project_id = null;
          }
        });
        localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
      }
    } catch {}

    if (!workspaceId.startsWith('local_') && supabase) {
      try {
        await supabase
          .from('board_projects')
          .delete()
          .eq('id', projectId);

        await supabase
          .from('boards')
          .update({ project_id: null })
          .eq('project_id', projectId);
      } catch {}
    }

    return true;
  },

  /**
   * Assigns a board to a project (or removes it from any project if null).
   */
  async assignBoardToProject(boardId: string, projectId: string | null): Promise<void> {
    try {
      const raw = localStorage.getItem(LOCAL_BOARDS_KEY);
      if (raw) {
        const boards = JSON.parse(raw);
        const target = boards.find((b: Record<string, unknown>) => b.id === boardId);
        if (target) {
          target.projectId = projectId;
          target.project_id = projectId;
          target.updated_at = new Date().toISOString();
          localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
        }
      }
    } catch {}

    if (!boardId.startsWith('board-') && supabase) {
      try {
        await supabase
          .from('boards')
          .update({ project_id: projectId, updated_at: new Date().toISOString() })
          .eq('id', boardId);
      } catch {}
    }
  },
};
