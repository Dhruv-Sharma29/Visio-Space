import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { workspaceService, type Workspace } from '../../services/workspaceService';
import { boardService, type BoardSummary } from '../../services/boardService';
import { BOARD_TEMPLATES } from '../../data/templates';
import { IconImport, IconTrash, IconEdit, IconCopy } from '../Icons/Icons';
import './Dashboard.css';

interface DashboardProps {
  onOpenBoard: (boardId: string) => void;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenBoard,
  onOpenAuth,
  onSignOut,
}) => {
  const { user, signOut } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Dialogs
  const [newBoardModalOpen, setNewBoardModalOpen] = useState(false);
  const [newWorkspaceModalOpen, setNewWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renamingBoard, setRenamingBoard] = useState<BoardSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [activeMenuBoardId, setActiveMenuBoardId] = useState<string | null>(null);

  // Load workspaces on mount or user change
  useEffect(() => {
    let active = true;
    setLoading(true);
    workspaceService.getMyWorkspaces(user?.id).then(wsList => {
      if (!active) return;
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        setCurrentWorkspace(wsList[0]);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Load boards whenever current workspace changes
  useEffect(() => {
    if (!currentWorkspace) return;
    let active = true;
    boardService.listBoards(currentWorkspace.id, user?.id).then(bList => {
      if (!active) return;
      setBoards(bList);
    });
    return () => {
      active = false;
    };
  }, [currentWorkspace, user?.id]);

  // Filtered boards
  const filteredBoards = useMemo(() => {
    if (!searchQuery.trim()) return boards;
    const query = searchQuery.toLowerCase();
    return boards.filter(b => b.title.toLowerCase().includes(query));
  }, [boards, searchQuery]);

  // Create a new blank board or from a template
  const handleCreateBoard = async (title: string, templateId?: string) => {
    if (!currentWorkspace) return;
    setNewBoardModalOpen(false);

    let initialState;
    if (templateId) {
      const template = BOARD_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        initialState = template.state;
      }
    }

    const created = await boardService.createBoard(
      currentWorkspace.id,
      title || 'Untitled Board',
      initialState,
      user?.id,
    );

    setBoards(prev => [created, ...prev]);
    onOpenBoard(created.id);
  };

  // Create a new workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      const created = await workspaceService.createWorkspace(newWorkspaceName.trim(), user?.id);
      setWorkspaces(prev => [...prev, created]);
      setCurrentWorkspace(created);
      setNewWorkspaceName('');
      setNewWorkspaceModalOpen(false);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to create workspace');
    }
  };

  // Rename board
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingBoard || !renameTitle.trim()) return;
    const trimmed = renameTitle.trim();
    await boardService.renameBoard(renamingBoard.id, trimmed);
    setBoards(prev => prev.map(b => b.id === renamingBoard.id ? { ...b, title: trimmed } : b));
    setRenamingBoard(null);
  };

  // Duplicate board
  const handleDuplicate = async (boardId: string) => {
    setActiveMenuBoardId(null);
    const duplicated = await boardService.duplicateBoard(boardId, user?.id);
    setBoards(prev => [duplicated, ...prev]);
  };

  // Delete board
  const handleDelete = async (boardId: string) => {
    setActiveMenuBoardId(null);
    if (!window.confirm('Are you sure you want to delete this board?')) return;
    await boardService.deleteBoard(boardId);
    setBoards(prev => prev.filter(b => b.id !== boardId));
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Top Navbar */}
      <header className="dashboard-navbar">
        <div className="dashboard-nav-left">
          <div className="dashboard-brand">
            <img src="/visiospace-mark.svg" alt="" className="dashboard-logo" />
            <div className="dashboard-brand-text">
              <span className="dashboard-brand-name">VisioSpace</span>
              <span className="dashboard-brand-tag">Collaborative Sensemaking</span>
            </div>
          </div>

          <div className="dashboard-workspace-picker">
            <span className="dashboard-ws-label">Workspace:</span>
            <select
              className="dashboard-ws-select"
              value={currentWorkspace?.id || ''}
              onChange={e => {
                const ws = workspaces.find(w => w.id === e.target.value);
                if (ws) setCurrentWorkspace(ws);
              }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="dashboard-add-ws-btn"
              title="Create new workspace"
              onClick={() => setNewWorkspaceModalOpen(true)}
            >
              +
            </button>
          </div>
        </div>

        <div className="dashboard-nav-right">
          {user ? (
            <div className="dashboard-user-menu">
              <div className="dashboard-avatar">
                {(user.email?.[0] || 'U').toUpperCase()}
              </div>
              <span className="dashboard-user-email">{user.email}</span>
              <button
                type="button"
                className="dashboard-auth-btn"
                onClick={() => {
                  signOut();
                  onSignOut?.();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="dashboard-guest-status">
              <span className="dashboard-guest-badge">Guest Session</span>
              <button
                type="button"
                className="dashboard-signin-btn"
                onClick={onOpenAuth}
              >
                Sign in / Register
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-main">
        {/* Gallery Subheader */}
        <div className="dashboard-header-row">
          <div className="dashboard-title-group">
            <h1 className="dashboard-title">My Boards</h1>
            <p className="dashboard-subtitle">
              {currentWorkspace ? `${currentWorkspace.name} · ` : ''}
              {boards.length} {boards.length === 1 ? 'board' : 'boards'}
            </p>
          </div>

          <div className="dashboard-actions-group">
            <div className="dashboard-search-wrap">
              <span className="dashboard-search-icon">🔍</span>
              <input
                type="search"
                className="dashboard-search-input"
                placeholder="Search boards…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="dashboard-new-board-btn"
              onClick={() => setNewBoardModalOpen(true)}
            >
              + New Board
            </button>
          </div>
        </div>

        {/* Board Cards Grid */}
        {loading ? (
          <div className="dashboard-loading">Loading your boards…</div>
        ) : filteredBoards.length === 0 ? (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon">📌</div>
            <h2>{searchQuery ? 'No boards matched your search' : 'No boards in this workspace yet'}</h2>
            <p>Start with a blank canvas or jumpstart your sensemaking with a curated template.</p>
            <div className="dashboard-empty-actions">
              <button
                type="button"
                className="dashboard-empty-btn primary"
                onClick={() => handleCreateBoard('Untitled Board')}
              >
                + Create Blank Board
              </button>
              <button
                type="button"
                className="dashboard-empty-btn"
                onClick={() => setNewBoardModalOpen(true)}
              >
                Explore Sensemaking Templates →
              </button>
            </div>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Quick New Board Card */}
            <button
              type="button"
              className="dashboard-card create-card"
              onClick={() => setNewBoardModalOpen(true)}
            >
              <div className="create-card-inner">
                <span className="create-card-plus">+</span>
                <span className="create-card-text">Create New Board</span>
                <span className="create-card-sub">Blank or Template</span>
              </div>
            </button>

            {/* Board Cards */}
            {filteredBoards.map(board => (
              <div
                key={board.id}
                className="dashboard-card board-card"
                onClick={() => onOpenBoard(board.id)}
              >
                {/* Visual Preview Header */}
                <div className="board-card-preview">
                  <div className="board-card-pin" />
                  <div className="board-card-sketch">
                    <div className="sketch-card c1" />
                    <div className="sketch-card c2" />
                    <div className="sketch-thread" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="board-card-body">
                  <div className="board-card-header">
                    <h3 className="board-card-title" title={board.title}>
                      {board.title}
                    </h3>

                    {/* Context Menu Trigger */}
                    <div
                      className="board-card-menu-wrap"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="board-card-menu-btn"
                        onClick={() => setActiveMenuBoardId(activeMenuBoardId === board.id ? null : board.id)}
                        aria-label="Board options"
                      >
                        •••
                      </button>

                      {activeMenuBoardId === board.id && (
                        <div className="board-card-dropdown">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuBoardId(null);
                              setRenamingBoard(board);
                              setRenameTitle(board.title);
                            }}
                          >
                            <IconEdit size={14} /> Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(board.id)}
                          >
                            <IconCopy size={14} /> Duplicate
                          </button>
                          <div className="dropdown-divider" />
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDelete(board.id)}
                          >
                            <IconTrash size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="board-card-chips">
                    <span className="board-chip">{board.cardCount} cards</span>
                    {board.shapeCount > 0 && <span className="board-chip">{board.shapeCount} shapes</span>}
                    {board.connectorCount > 0 && <span className="board-chip">{board.connectorCount} threads</span>}
                  </div>

                  <div className="board-card-footer">
                    <span className="board-card-date">Edited {formatRelativeTime(board.updated_at)}</span>
                    <span className="board-card-open-hint">Open →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Board / Template Modal */}
      {newBoardModalOpen && (
        <div className="dashboard-modal-overlay" onClick={() => setNewBoardModalOpen(false)}>
          <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h2>Create a New Board</h2>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setNewBoardModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="dashboard-modal-content">
              <div
                className="template-choice-card blank"
                onClick={() => handleCreateBoard('Untitled Board')}
              >
                <div className="template-icon">📄</div>
                <div className="template-info">
                  <strong>Blank Canvas</strong>
                  <p>Start completely fresh with an empty affinity sensemaking workspace.</p>
                </div>
                <span className="template-action">Start blank →</span>
              </div>

              <div className="template-divider">
                <span>or choose a template</span>
              </div>

              <div className="templates-grid-modal">
                {BOARD_TEMPLATES.map(template => (
                  <div
                    key={template.id}
                    className="template-choice-card"
                    onClick={() => handleCreateBoard(template.name, template.id)}
                  >
                    <div className="template-icon">
                      <IconImport size={20} />
                    </div>
                    <div className="template-info">
                      <strong>{template.name}</strong>
                      <p>{template.description}</p>
                    </div>
                    <span className="template-action">Use template →</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Workspace Modal */}
      {newWorkspaceModalOpen && (
        <div className="dashboard-modal-overlay" onClick={() => setNewWorkspaceModalOpen(false)}>
          <div className="dashboard-modal small" onClick={e => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h2>New Workspace</h2>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setNewWorkspaceModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="dashboard-modal-form">
              <label>
                Workspace Name
                <input
                  type="text"
                  required
                  placeholder="e.g. Design Research, Strategy Team"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                  autoFocus
                />
              </label>

              <div className="dashboard-modal-actions">
                <button
                  type="button"
                  className="dashboard-btn-secondary"
                  onClick={() => setNewWorkspaceModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-btn-primary">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Board Modal */}
      {renamingBoard && (
        <div className="dashboard-modal-overlay" onClick={() => setRenamingBoard(null)}>
          <div className="dashboard-modal small" onClick={e => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h2>Rename Board</h2>
              <button
                type="button"
                className="dashboard-modal-close"
                onClick={() => setRenamingBoard(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRename} className="dashboard-modal-form">
              <label>
                Board Title
                <input
                  type="text"
                  required
                  value={renameTitle}
                  onChange={e => setRenameTitle(e.target.value)}
                  autoFocus
                />
              </label>

              <div className="dashboard-modal-actions">
                <button
                  type="button"
                  className="dashboard-btn-secondary"
                  onClick={() => setRenamingBoard(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="dashboard-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
