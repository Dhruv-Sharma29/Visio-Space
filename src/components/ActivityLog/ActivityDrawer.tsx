import React, { useState, useEffect, useCallback } from 'react';
import type { ActivityLogItem } from '../../types/board.ts';
import { activityService } from '../../services/activityService.ts';
import { IconActivity } from '../Icons/Icons.tsx';
import './ActivityDrawer.css';

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'card_add': return 'Added Card';
    case 'card_delete': return 'Deleted Card';
    case 'card_edit': return 'Edited Card';
    case 'shape_add': return 'Added Shape';
    case 'cluster_create': return 'Created Group';
    case 'comment_add': return 'Commented';
    case 'comment_resolve': return 'Resolved Comment';
    case 'version_create': return 'Saved Version';
    case 'version_restore': return 'Restored Version';
    case 'board_share_update': return 'Updated Access';
    default: return 'Activity';
  }
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({
  isOpen,
  onClose,
  boardId,
}) => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);

  const loadActivities = useCallback(async () => {
    if (!boardId) return;
    const items = await activityService.getActivities(boardId);
    setActivities(items);
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      loadActivities();
    }
  }, [isOpen, loadActivities]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="activity-drawer-backdrop" onClick={onClose} />
      <aside className="activity-drawer" aria-label="Activity Feed">
        <header className="activity-drawer-header">
          <div className="activity-drawer-title">
            <span className="activity-drawer-title-icon">
              <IconActivity size={18} />
            </span>
            <span>Board Activity</span>
          </div>
          <button
            type="button"
            className="activity-drawer-close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="activity-drawer-list">
          {activities.length === 0 ? (
            <div className="activity-drawer-empty">
              No recent activity recorded yet. Edits, comments, and version events will show up here.
            </div>
          ) : (
            activities.map((item) => {
              const initials = item.userName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={item.id} className="activity-item">
                  <div className="activity-item-avatar">
                    {item.userAvatar ? (
                      <img src={item.userAvatar} alt={item.userName} />
                    ) : (
                      initials || 'U'
                    )}
                  </div>
                  <div className="activity-item-content">
                    <div className="activity-item-header">
                      <span className="activity-item-user">{item.userName}</span>
                      <span className="activity-item-time">{timeAgo(item.createdAt)}</span>
                    </div>
                    <span className="activity-item-desc">{item.description}</span>
                    <span className="activity-item-badge">{getActionLabel(item.action)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
