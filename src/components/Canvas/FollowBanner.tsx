import React, { useState, useEffect } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { realtimeService, type PresenceUser } from '../../services/realtimeService';
import './FollowBanner.css';

export const FollowBanner: React.FC = () => {
  const { followingUserId, setFollowingUserId } = useBoardStore();
  const [followedUser, setFollowedUser] = useState<PresenceUser | null>(null);

  useEffect(() => {
    if (!followingUserId) {
      setFollowedUser(null);
      return;
    }

    const updateFollowed = (users: PresenceUser[]) => {
      const target = users.find((u) => u.userId === followingUserId);
      if (target) {
        setFollowedUser(target);
      } else {
        // User left
        setFollowingUserId(null);
      }
    };

    const presences = realtimeService.getActivePresences();
    updateFollowed(presences);

    return realtimeService.onPresence(updateFollowed);
  }, [followingUserId, setFollowingUserId]);

  if (!followingUserId || !followedUser) return null;

  const displayName = followedUser.username ? `@${followedUser.username}` : followedUser.fullName;

  return (
    <div className="follow-banner" role="status">
      <div className="follow-banner-pulse" style={{ backgroundColor: followedUser.color }} />
      <span className="follow-banner-icon">👁</span>
      <span className="follow-banner-text">
        Following <strong style={{ color: followedUser.color }}>{displayName}</strong>
      </span>
      <span className="follow-banner-hint">· Pan/zoom or press Esc to stop</span>
      <button
        type="button"
        className="follow-banner-close-btn"
        onClick={() => setFollowingUserId(null)}
        title="Stop following"
      >
        ×
      </button>
    </div>
  );
};
