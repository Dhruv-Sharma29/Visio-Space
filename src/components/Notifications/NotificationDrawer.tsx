import React, { useEffect, useState, useCallback } from 'react';
import type { InAppNotification } from '../../types/board.ts';
import { notificationService } from '../../services/notificationService.ts';
import { IconBell, IconAtSign, IconComment, IconCheckCircle } from '../Icons/Icons.tsx';
import './NotificationDrawer.css';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  onNotificationClick: (notif: InAppNotification) => void;
  onUnreadCountChange?: (count: number) => void;
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

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  userId,
  onNotificationClick,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  const loadNotifs = useCallback(async () => {
    if (!userId) return;
    const items = await notificationService.getNotifications(userId);
    setNotifications(items);
    if (onUnreadCountChange) {
      onUnreadCountChange(items.filter(n => !n.read).length);
    }
  }, [userId, onUnreadCountChange]);

  useEffect(() => {
    loadNotifs();
  }, [userId, loadNotifs, isOpen]);

  // Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await notificationService.markAllAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (onUnreadCountChange) onUnreadCountChange(0);
  };

  const handleClickItem = async (notif: InAppNotification) => {
    if (userId && !notif.read) {
      await notificationService.markAsRead(userId, notif.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
      );
      if (onUnreadCountChange) {
        const remaining = notifications.filter(n => n.id !== notif.id && !n.read).length;
        onUnreadCountChange(remaining);
      }
    }
    onNotificationClick(notif);
    onClose();
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <div className="notification-drawer-overlay" onClick={onClose} />
      <div className="notification-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="notification-header">
          <div className="notification-header-left">
            <h3 className="notification-title">Notifications</h3>
            {unreadCount > 0 && (
              <span className="notification-count-badge">{unreadCount}</span>
            )}
          </div>
          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              className="notification-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="notification-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <IconBell size={24} color="rgba(244, 236, 216, 0.3)" />
              <span>No notifications yet</span>
            </div>
          ) : (
            notifications.map(n => {
              return (
                <div
                  key={n.id}
                  className={`notification-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleClickItem(n)}
                >
                  <div className={`notification-icon-box ${n.type}`}>
                    {n.type === 'mention' && <IconAtSign size={14} />}
                    {n.type === 'reply' && <IconComment size={14} />}
                    {n.type === 'comment_resolve' && <IconCheckCircle size={14} />}
                  </div>

                  <div className="notification-item-content">
                    <span className="notification-item-title">{n.title}</span>
                    <span className="notification-item-body">{n.body}</span>
                    <span className="notification-item-time">{timeAgo(n.createdAt)}</span>
                  </div>

                  {!n.read && <div className="notification-unread-dot" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
