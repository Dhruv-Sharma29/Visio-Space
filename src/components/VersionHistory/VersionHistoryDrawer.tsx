import React, { useState, useEffect, useCallback } from 'react';
import type { BoardSnapshot, BoardState } from '../../types/board.ts';
import { versionService } from '../../services/versionService.ts';
import { activityService } from '../../services/activityService.ts';
import { IconHistory, IconRotateCcw } from '../Icons/Icons.tsx';
import './VersionHistoryDrawer.css';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  currentState: BoardState;
  currentUserId?: string | null;
  currentUserName?: string;
  onRestoreState: (state: BoardState) => void;
}

function formatSnapshotDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  boardId,
  currentState,
  currentUserId,
  currentUserName = 'Collaborator',
  onRestoreState,
}) => {
  const [snapshots, setSnapshots] = useState<BoardSnapshot[]>([]);
  const [newVersionName, setNewVersionName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!boardId) return;
    const items = await versionService.getSnapshots(boardId);
    setSnapshots(items);
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, loadSnapshots]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardId || loading) return;

    setLoading(true);
    const name = newVersionName.trim() || `Version ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const created = await versionService.createSnapshot(
      boardId,
      name,
      currentState,
      { id: currentUserId, name: currentUserName }
    );

    // Log activity
    await activityService.logActivity(boardId, {
      action: 'version_create',
      description: `Saved version snapshot "${name}"`,
      user: { id: currentUserId, name: currentUserName },
    });

    setSnapshots((prev) => [created, ...prev]);
    setNewVersionName('');
    setLoading(false);
  };

  const handleRestore = async (snap: BoardSnapshot) => {
    const confirmed = window.confirm(
      `Revert canvas to version "${snap.name}"?\n\nA backup of the current canvas will be saved automatically.`
    );
    if (!confirmed) return;

    setLoading(true);
    const restored = await versionService.restoreSnapshot(
      boardId,
      snap.id,
      currentState,
      { id: currentUserId, name: currentUserName }
    );

    if (restored) {
      // Log activity
      await activityService.logActivity(boardId, {
        action: 'version_restore',
        description: `Restored canvas to version "${snap.name}"`,
        user: { id: currentUserId, name: currentUserName },
      });

      onRestoreState(restored);
      await loadSnapshots();
      onClose();
    }
    setLoading(false);
  };

  const handleDelete = async (snapId: string) => {
    if (!window.confirm('Delete this saved version?')) return;
    await versionService.deleteSnapshot(boardId, snapId);
    setSnapshots((prev) => prev.filter((s) => s.id !== snapId));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="version-drawer-backdrop" onClick={onClose} />
      <aside className="version-drawer" aria-label="Version History">
        <header className="version-drawer-header">
          <div className="version-drawer-title">
            <span className="version-drawer-title-icon">
              <IconHistory size={18} />
            </span>
            <span>Version History</span>
          </div>
          <button
            type="button"
            className="version-drawer-close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>

        {/* Save Snapshot Section */}
        <form className="version-drawer-save-section" onSubmit={handleSaveSnapshot}>
          <label className="version-drawer-save-label" htmlFor="version-name-input">
            Save Current State
          </label>
          <div className="version-drawer-save-box">
            <input
              id="version-name-input"
              type="text"
              className="version-drawer-save-input"
              placeholder="e.g. Sprint 2 Planning Final"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
            />
            <button
              type="submit"
              className="version-drawer-save-btn"
              disabled={loading}
            >
              Save Version
            </button>
          </div>
        </form>

        {/* Timeline List */}
        <div className="version-drawer-list">
          {snapshots.length === 0 ? (
            <div className="version-drawer-empty">
              No saved versions yet. Save a snapshot above to capture your canvas milestones!
            </div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="version-item-card">
                <div className="version-item-header">
                  <span className="version-item-name" title={snap.name}>
                    {snap.name}
                  </span>
                  <span className="version-item-date">{formatSnapshotDate(snap.createdAt)}</span>
                </div>
                <div className="version-item-meta">
                  <span className="version-item-author">By {snap.createdByName}</span>
                  <div className="version-item-counts">
                    <span>{snap.itemCount?.cards || 0} cards</span>
                    <span>·</span>
                    <span>{snap.itemCount?.shapes || 0} shapes</span>
                    <span>·</span>
                    <span>{snap.itemCount?.clusters || 0} groups</span>
                  </div>
                </div>
                <div className="version-item-actions">
                  <button
                    type="button"
                    className="version-item-delete-btn"
                    title="Delete version snapshot"
                    onClick={() => handleDelete(snap.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="version-item-restore-btn"
                    title="Restore this version (creates backup first)"
                    onClick={() => handleRestore(snap)}
                  >
                    <IconRotateCcw size={13} />
                    <span>Restore</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
};
