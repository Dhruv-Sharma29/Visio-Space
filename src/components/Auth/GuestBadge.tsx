import React from 'react';
import './GuestBadge.css';

interface GuestBadgeProps {
  onSignIn?: () => void;
}

export const GuestBadge: React.FC<GuestBadgeProps> = ({ onSignIn }) => {
  return (
    <aside className="guest-badge" aria-label="Guest session status">
      <div className="guest-badge-pill" title="You are using VisioSpace in Guest Mode. Data is kept in this browser session only.">
        <span className="guest-badge-dot" aria-hidden="true" />
        <span className="guest-badge-label">Guest Mode</span>
        <span className="guest-badge-sub">· Session only</span>
      </div>
      {onSignIn && (
        <button
          type="button"
          className="guest-badge-action"
          onClick={onSignIn}
          title="Sign in or create an account to save your board"
        >
          Sign In
        </button>
      )}
    </aside>
  );
};
