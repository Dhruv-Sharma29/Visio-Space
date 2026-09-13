import React, { useState, useEffect } from 'react';
import { realtimeService, type PresenceUser, type CursorUpdateMessage } from '../../services/realtimeService';
import type { Viewport } from '../../types/board';
import './RemoteCursorsOverlay.css';

interface RemoteCursorsOverlayProps {
  viewport: Viewport;
}

interface ActiveRemoteCursor {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
}

export const RemoteCursorsOverlay: React.FC<RemoteCursorsOverlayProps> = ({ viewport }) => {
  const [remoteCursors, setRemoteCursors] = useState<Map<string, ActiveRemoteCursor>>(new Map());

  useEffect(() => {
    // Map of presence users to quickly lookup color and names
    let presenceMap = new Map<string, PresenceUser>();

    const unsubscribePresence = realtimeService.onPresence((users) => {
      const newMap = new Map<string, PresenceUser>();
      users.forEach((u) => newMap.set(u.userId, u));
      presenceMap = newMap;

      // Prune cursors for users who left
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [userId] of next) {
          if (!newMap.has(userId)) {
            next.delete(userId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    const unsubscribeCursor = realtimeService.onCursor((msg: CursorUpdateMessage) => {
      const current = realtimeService.getCurrentUser();
      if (msg.userId === current?.userId) return;

      setRemoteCursors((prev) => {
        const next = new Map(prev);
        if (!msg.cursor) {
          if (next.has(msg.userId)) {
            next.delete(msg.userId);
            return next;
          }
          return prev;
        }

        const user = presenceMap.get(msg.userId);
        const name = user?.username ? `@${user.username}` : user?.fullName || 'Collaborator';
        const color = user?.color || '#E05A47';

        next.set(msg.userId, {
          userId: msg.userId,
          name,
          color,
          x: msg.cursor.x,
          y: msg.cursor.y,
          lastActive: Date.now(),
        });
        return next;
      });
    });

    // Cleanup idle cursors every second
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, cursor] of next.entries()) {
          if (now - cursor.lastActive > 3500) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      unsubscribePresence();
      unsubscribeCursor();
      clearInterval(cleanupInterval);
    };
  }, []);

  if (remoteCursors.size === 0) return null;

  return (
    <div className="remote-cursors-overlay" aria-hidden="true">
      {Array.from(remoteCursors.values()).map((c) => {
        // Convert canvas coordinates to screen coordinates
        const screenX = c.x * viewport.scale + viewport.x;
        const screenY = c.y * viewport.scale + viewport.y;

        return (
          <div
            key={c.userId}
            className="remote-cursor"
            style={{
              transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
            }}
          >
            {/* Sleek pointer SVG */}
            <svg
              className="remote-cursor-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                fill={c.color}
                stroke="#1B1410"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Collaborator Badge */}
            <div
              className="remote-cursor-badge"
              style={{
                backgroundColor: c.color,
              }}
            >
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
