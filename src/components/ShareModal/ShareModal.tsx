import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useBoardStore } from '../../store/boardStore';
import { sharingService } from '../../services/sharingService';
import type { BoardCollaborator, BoardRole, PublicAccessLevel } from '../../types/board';
import { IconShare, IconLock, IconGlobe, IconUserPlus, IconCheck, IconCopy } from '../Icons/Icons';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardTitle,
}) => {
  const { user } = useAuth();
  const currentRole = useBoardStore(s => s.currentRole);
  const canEdit = useBoardStore(s => s.canEdit());

  const [loading, setLoading] = useState(true);
  const [publicAccess, setPublicAccess] = useState<PublicAccessLevel>('private');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);

  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<BoardRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load share settings and collaborator roster
  const loadData = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const [settings, roster] = await Promise.all([
        sharingService.getShareSettings(boardId),
        sharingService.getCollaborators(boardId, user?.id),
      ]);
      setPublicAccess(settings.publicAccess);
      setShareUrl(settings.shareUrl);
      setCollaborators(roster);
    } catch {
      setError('Could not load sharing settings');
    } finally {
      setLoading(false);
    }
  }, [boardId, user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setCopied(false);
      setInviteIdentifier('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, loadData]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy share URL to clipboard
  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const input = document.createElement('textarea');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Change general link access
  const handleAccessChange = async (newAccess: PublicAccessLevel) => {
    setPublicAccess(newAccess);
    setError(null);
    try {
      await sharingService.updatePublicAccess(boardId, newAccess);
      const settings = await sharingService.getShareSettings(boardId);
      setShareUrl(settings.shareUrl);
    } catch {
      setError('Failed to update general access settings');
    }
  };

  // Invite new collaborator
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;

    setInviting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await sharingService.inviteCollaborator(boardId, inviteIdentifier.trim(), inviteRole);
      if (res.success) {
        setSuccessMsg(`Invited @${inviteIdentifier.trim().replace(/^@/, '')} as ${inviteRole}`);
        setInviteIdentifier('');
        const updated = await sharingService.getCollaborators(boardId, user?.id);
        setCollaborators(updated);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.error || 'Failed to invite collaborator');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  // Change collaborator role
  const handleRoleChange = async (userId: string, newRole: BoardRole) => {
    try {
      await sharingService.updateCollaboratorRole(boardId, userId, newRole);
      setCollaborators(prev =>
        prev.map(c => (c.userId === userId ? { ...c, role: newRole } : c))
      );
    } catch {
      setError('Failed to update collaborator role');
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this board?`)) return;
    try {
      await sharingService.removeCollaborator(boardId, userId);
      setCollaborators(prev => prev.filter(c => c.userId !== userId));
    } catch {
      setError('Failed to remove collaborator');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-header">
          <div className="share-header-left">
            <div className="share-header-icon">
              <IconShare size={20} />
            </div>
            <div>
              <h2 className="share-header-title">Share Board</h2>
              <p className="share-header-subtitle" title={boardTitle}>
                {boardTitle || 'Untitled Board'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="share-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="share-modal-body">
          {error && <div className="share-alert error">{error}</div>}
          {successMsg && <div className="share-alert success">{successMsg}</div>}

          {/* Section 1: General Access & Link */}
          <div className="share-section">
            <h3 className="share-section-title">General Access</h3>
            <div className="share-access-card">
              <div className="share-access-row">
                <div className="share-access-info">
                  <div className="share-access-icon">
                    {publicAccess === 'private' ? (
                      <IconLock size={18} />
                    ) : (
                      <IconGlobe size={18} />
                    )}
                  </div>
                  <div className="share-access-text">
                    <span className="share-access-heading">
                      {publicAccess === 'private'
                        ? 'Restricted Access'
                        : publicAccess === 'viewer'
                        ? 'Anyone with the link'
                        : 'Anyone with the link'}
                    </span>
                    <span className="share-access-desc">
                      {publicAccess === 'private'
                        ? 'Only people invited can access this board'
                        : publicAccess === 'viewer'
                        ? 'Anyone who has the link can view without editing'
                        : 'Anyone who has the link can edit the board'}
                    </span>
                  </div>
                </div>

                <select
                  className="share-access-select"
                  value={publicAccess}
                  onChange={e => handleAccessChange(e.target.value as PublicAccessLevel)}
                  disabled={!canEdit}
                  title={!canEdit ? 'Only editors can change access' : 'Choose access level'}
                >
                  <option value="private">Restricted</option>
                  <option value="viewer">Can View</option>
                  <option value="editor">Can Edit</option>
                </select>
              </div>

              {/* Link copy bar */}
              <div className="share-link-box">
                <input
                  type="text"
                  readOnly
                  className="share-link-input"
                  value={shareUrl || 'Generating share link…'}
                  onFocus={e => e.target.select()}
                />
                <button
                  type="button"
                  className={`share-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                  disabled={loading}
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Invite Collaborators */}
          <div className="share-section">
            <h3 className="share-section-title">Invite Collaborators</h3>
            {canEdit ? (
              <form className="share-invite-form" onSubmit={handleInvite}>
                <div className="share-input-wrapper">
                  <span className="share-input-prefix">@</span>
                  <input
                    type="text"
                    className="share-invite-input"
                    placeholder="username or email"
                    value={inviteIdentifier}
                    onChange={e => setInviteIdentifier(e.target.value)}
                    disabled={inviting}
                  />
                </div>
                <select
                  className="share-role-select"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as BoardRole)}
                  disabled={inviting}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="share-invite-btn"
                  disabled={inviting || !inviteIdentifier.trim()}
                >
                  <IconUserPlus size={15} />
                  <span>{inviting ? 'Inviting…' : 'Invite'}</span>
                </button>
              </form>
            ) : (
              <div className="share-notice">
                Only board owners and editors can invite new collaborators.
              </div>
            )}
          </div>

          {/* Section 3: Collaborator Roster */}
          <div className="share-section">
            <h3 className="share-section-title">
              Collaborators ({collaborators.length})
            </h3>
            <div className="share-roster">
              {collaborators.map(collaborator => {
                const isOwner = collaborator.role === 'owner';
                const initial = (collaborator.fullName || collaborator.username || '?')
                  .charAt(0)
                  .toUpperCase();

                return (
                  <div key={collaborator.userId} className="share-roster-item">
                    <div className="share-member-info">
                      <div className="share-member-avatar">
                        {collaborator.avatarUrl ? (
                          <img
                            src={collaborator.avatarUrl}
                            alt={collaborator.username}
                          />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className="share-member-details">
                        <span className="share-member-name">
                          {collaborator.fullName || collaborator.username}
                        </span>
                        <span className="share-member-username">
                          @{collaborator.username}
                        </span>
                      </div>
                    </div>

                    <div className="share-member-actions">
                      {isOwner ? (
                        <span className="share-role-badge owner">Owner</span>
                      ) : canEdit && currentRole === 'owner' ? (
                        <>
                          <select
                            className="share-member-role-select"
                            value={collaborator.role}
                            onChange={e =>
                              handleRoleChange(
                                collaborator.userId,
                                e.target.value as BoardRole
                              )
                            }
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            type="button"
                            className="share-remove-btn"
                            title="Remove collaborator"
                            onClick={() =>
                              handleRemoveCollaborator(
                                collaborator.userId,
                                collaborator.fullName || collaborator.username
                              )
                            }
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="share-role-badge">
                          {collaborator.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="share-modal-footer">
          <button type="button" className="share-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
