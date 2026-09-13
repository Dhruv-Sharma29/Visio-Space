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

import { projectService } from '../src/services/projectService.ts';

test('projectService manages projects and board assignment in local fallback mode', async () => {
  storage.clear();
  const workspaceId = 'local_workspace_1';
  const boardId = 'board-proj-test-1';

  // Seed initial board in localStorage
  storage.set(
    'visiospace_boards_list',
    JSON.stringify([
      {
        id: boardId,
        title: 'Sprint Retrospective',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        projectId: null,
      },
    ])
  );

  // 1. Create Projects
  const p1 = await projectService.createProject(workspaceId, 'Q3 Product Discovery', '#3b82f6');
  const p2 = await projectService.createProject(workspaceId, 'Engineering Architecture', '#10b981');

  assert.ok(p1.id.startsWith('proj_'));
  assert.equal(p1.name, 'Q3 Product Discovery');
  assert.equal(p1.color, '#3b82f6');

  // 2. List Projects
  let list = await projectService.getProjects(workspaceId);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, p1.id);
  assert.equal(list[1].id, p2.id);

  // 3. Assign board to project p1
  await projectService.assignBoardToProject(boardId, p1.id);

  const boardsAfterAssign = JSON.parse(storage.get('visiospace_boards_list') || '[]');
  assert.equal(boardsAfterAssign[0].projectId, p1.id);

  // 4. Delete project p1 -> should unlink board to null, keeping the board safe
  await projectService.deleteProject(workspaceId, p1.id);

  list = await projectService.getProjects(workspaceId);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, p2.id);

  const boardsAfterDelete = JSON.parse(storage.get('visiospace_boards_list') || '[]');
  assert.equal(boardsAfterDelete[0].projectId, null, 'Board should be unlinked when project is deleted');
});
