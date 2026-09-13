import React, { useState, useEffect } from 'react';
import { realtimeService, type PresenceUser } from '../../services/realtimeService';
import { useBoardStore } from '../../store/boardStore';
import './PresenceHeaderBar.css';

export const PresenceHeaderBar: React.FC = () => {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const { followingUserId, setFollowingUserId } = useBoardStore();

  useEffect(() => {
    return realtimeService.onPresence((activeUsers) => {
      const current = realtimeService.getCurrentUser();
      // Filter out self so we show remote collaborators
      const remoteUsers = activeUsers.filter((u) => u.userId !== current?.userId);
      setUsers(remoteUsers);

      // If the user we are following left, clear follow state
      if (followingUserId && !remoteUsers.some((u) => u.userId === followingUserId)) {
        setFollowingUserId(null);
      }
    });
  }, [followingUserId, setFollowingUserId]);

  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, 4);
  const overflowCount = users.length - visibleUsers.length;

  const handleAvatarClick = (userId: string) => {
    if (followingUserId === userId) {
      setFollowingUserId(null);
    } else {
      setFollowingUserId(userId);
    }
  };

  return (
    <div className="presence-header-bar" title="Active collaborators on this board">
      <div className="presence-avatar-stack">
        {visibleUsers.map((user) => {
          const isFollowing = followingUserId === user.userId;
          const initial = (user.fullName?.[0] || user.username?.[0] || '?').toUpperCase();
          const displayName = user.username ? `@${user.username}` : user.fullName;

          return (
            <button
              key={user.userId}
              type="button"
              className={`presence-avatar-btn ${isFollowing ? 'following' : ''}`}
              style={{
                borderColor: user.color,
                boxShadow: isFollowing ? `0 0 0 2px #d6a85f, 0 0 8px ${user.color}` : undefined,
              }}
              onClick={() => handleAvatarClick(user.userId)}
              title={
                isFollowing
                  ? `Following ${displayName} (Click to stop)`
                  : `Click to follow ${displayName}`
              }
            >
              {user.avatarUrl && !user.avatarUrl.startsWith('http') ? (
                <span className="presence-avatar-emoji">{user.avatarUrl}</span>
              ) : user.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="presence-avatar-img" />
              ) : (
                <span className="presence-avatar-initial" style={{ color: user.color }}>
                  {initial}
                </span>
              )}
              {isFollowing && <span className="presence-following-dot" style={{ backgroundColor: user.color }} />}
            </button>
          );
        })}

        {overflowCount > 0 && (
          <div className="presence-overflow-badge" title={`${overflowCount} more collaborator${overflowCount > 1 ? 's' : ''}`}>
            +{overflowCount}
          </div>
        )}
      </div>
    </div>
  );
};
