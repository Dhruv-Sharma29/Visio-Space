import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardCollaborator, Card, CommentItem, Viewport } from '../../types/board.ts';
import { commentService } from '../../services/commentService.ts';
import { sharingService } from '../../services/sharingService.ts';
import { realtimeService } from '../../services/realtimeService.ts';
import { IconCheckCircle, IconSend } from '../Icons/Icons.tsx';
import './CommentThreadPopover.css';

interface CommentThreadPopoverProps {
  boardId: string;
  commentId: string | null;
  draftLocation?: { x: number; y: number; cardId?: string | null } | null;
  viewport: Viewport;
  cards: Card[];
  onClose: () => void;
  onCommentCreated?: (comment: CommentItem) => void;
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserAvatar?: string | null;
  isOwner?: boolean;
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

export const CommentThreadPopover: React.FC<CommentThreadPopoverProps> = ({
  boardId,
  commentId,
  draftLocation,
  viewport,
  cards,
  onClose,
  onCommentCreated,
  currentUserId,
  currentUserName = 'Collaborator',
  currentUserAvatar,
  isOwner = false,
}) => {
  const [comment, setComment] = useState<CommentItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);

  // Mentions autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load collaborators for @mentions
  useEffect(() => {
    if (!boardId) return;
    sharingService.getCollaborators(boardId, currentUserId).then(setCollaborators);
  }, [boardId, currentUserId]);

  // Load comment thread if viewing an existing comment
  const loadThread = useCallback(async () => {
    if (!commentId || !boardId) return;
    const all = await commentService.getBoardComments(boardId);
    const found = all.find(c => c.id === commentId);
    if (found) {
      setComment(found);
    }
  }, [boardId, commentId]);

  useEffect(() => {
    if (commentId) {
      loadThread();
    } else {
      setComment(null);
    }
  }, [commentId, loadThread]);

  // Focus input on open
  useEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [commentId, draftLocation]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mentionQuery !== null) {
          setMentionQuery(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mentionQuery, onClose]);

  // Handle textarea changes & detect @mention trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);

    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Insert selected mention into textarea
  const insertMention = (username: string) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBefore = inputText.slice(0, cursorPos);
    const textAfter = inputText.slice(cursorPos);

    const replacedBefore = textBefore.replace(/@([a-zA-Z0-9_-]*)$/, `@${username} `);
    const newText = replacedBefore + textAfter;
    setInputText(newText);
    setMentionQuery(null);

    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = replacedBefore.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // Keyboard navigation inside mentions autocomplete
  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredCollaborators.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredCollaborators.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredCollaborators.length) % filteredCollaborators.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredCollaborators[mentionIndex];
        if (selected) {
          insertMention(selected.username);
        }
        return;
      }
    }

    // Ctrl/Cmd + Enter to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const filteredCollaborators = mentionQuery !== null
    ? collaborators.filter(c =>
        c.username.toLowerCase().includes(mentionQuery) ||
        c.fullName.toLowerCase().includes(mentionQuery)
      )
    : [];

  // Submit comment (either root or reply)
  const handleSubmit = async () => {
    const body = inputText.trim();
    if (!body || loading) return;

    setLoading(true);
    try {
      if (draftLocation) {
        // Creating new root comment
        const newComment = await commentService.createComment(boardId, {
          cardId: draftLocation.cardId || null,
          x: draftLocation.x,
          y: draftLocation.y,
          body,
          authorId: currentUserId || null,
          authorName: currentUserName,
          authorAvatar: currentUserAvatar || null,
        });
        realtimeService.broadcastCommentUpdate();
        setInputText('');
        if (onCommentCreated) onCommentCreated(newComment);
      } else if (comment) {
        // Adding reply to existing thread
        await commentService.addReply(boardId, comment.id, {
          body,
          authorId: currentUserId || null,
          authorName: currentUserName,
          authorAvatar: currentUserAvatar || null,
        });
        realtimeService.broadcastCommentUpdate();
        setInputText('');
        await loadThread();
      }
    } finally {
      setLoading(false);
    }
  };

  // Resolve / Reopen toggle
  const handleToggleResolve = async () => {
    if (!comment) return;
    const newStatus = !comment.resolved;
    await commentService.resolveComment(boardId, comment.id, newStatus, currentUserName);
    realtimeService.broadcastCommentUpdate();
    setComment(prev => prev ? { ...prev, resolved: newStatus } : null);
  };

  // Delete thread
  const handleDelete = async () => {
    if (!comment) return;
    if (!window.confirm('Delete this comment thread?')) return;
    await commentService.deleteComment(boardId, comment.id);
    realtimeService.broadcastCommentUpdate();
    onClose();
  };

  // Render mentions highlighted in text
  const renderFormattedBody = (body: string) => {
    const parts = body.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="comment-mention-tag">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Compute position relative to viewport
  let canvasX = 0;
  let canvasY = 0;

  if (draftLocation) {
    canvasX = draftLocation.x;
    canvasY = draftLocation.y;
  } else if (comment) {
    if (comment.cardId) {
      const card = cards.find(c => c.id === comment.cardId);
      if (card) {
        canvasX = card.x + card.width - 18;
        canvasY = card.y - 12;
      } else {
        canvasX = comment.x;
        canvasY = comment.y;
      }
    } else {
      canvasX = comment.x;
      canvasY = comment.y;
    }
  }

  const screenX = canvasX * viewport.scale + viewport.x;
  const screenY = canvasY * viewport.scale + viewport.y;

  // Offset popover slightly to avoid covering pin
  const popoverLeft = Math.min(window.innerWidth - 360, Math.max(16, screenX + 18));
  const popoverTop = Math.min(window.innerHeight - 320, Math.max(60, screenY - 20));

  const isDraft = Boolean(draftLocation);
  const canDelete = isOwner || (comment && comment.authorId === currentUserId);

  return (
    <div
      className="comment-popover-container"
      style={{
        transform: `translate3d(${popoverLeft}px, ${popoverTop}px, 0)`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="comment-popover-card">
        {/* Header */}
        <div className="comment-popover-header">
          <div className="comment-popover-author">
            <div className="comment-author-avatar">
              {(isDraft ? currentUserAvatar : comment?.authorAvatar) ? (
                <img
                  src={isDraft ? currentUserAvatar! : comment!.authorAvatar!}
                  alt=""
                />
              ) : (
                <span>
                  {(isDraft ? currentUserName : comment?.authorName || 'C')
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div className="comment-author-meta">
              <span className="comment-author-name">
                {isDraft ? currentUserName : comment?.authorName}
              </span>
              {!isDraft && comment && (
                <span className="comment-timestamp">
                  {timeAgo(comment.createdAt)}
                </span>
              )}
            </div>
          </div>

          <div className="comment-popover-actions">
            {!isDraft && comment && (
              <button
                type="button"
                className={`comment-action-btn resolve ${comment.resolved ? 'resolved' : ''}`}
                onClick={handleToggleResolve}
                title={comment.resolved ? 'Re-open thread' : 'Mark as resolved'}
              >
                <IconCheckCircle size={15} />
              </button>
            )}

            {!isDraft && canDelete && (
              <button
                type="button"
                className="comment-action-btn delete"
                onClick={handleDelete}
                title="Delete comment"
              >
                ✕
              </button>
            )}

            <button
              type="button"
              className="comment-action-btn"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Existing thread content */}
        {!isDraft && comment && (
          <div className="comment-popover-content">
            <div className="comment-root-body">
              {renderFormattedBody(comment.body)}
            </div>

            {comment.replies && comment.replies.length > 0 && (
              <div className="comment-replies-list">
                {comment.replies.map(reply => (
                  <div key={reply.id} className="comment-reply-item">
                    <div className="comment-author-avatar">
                      {reply.authorAvatar ? (
                        <img src={reply.authorAvatar} alt="" />
                      ) : (
                        <span>{reply.authorName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="comment-reply-content">
                      <div className="comment-reply-header">
                        <span className="comment-reply-author">
                          {reply.authorName}
                        </span>
                        <span className="comment-timestamp">
                          {timeAgo(reply.createdAt)}
                        </span>
                      </div>
                      <div className="comment-reply-body">
                        {renderFormattedBody(reply.body)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input form */}
        <div className="comment-input-form">
          {/* Autocomplete mention popover */}
          {mentionQuery !== null && filteredCollaborators.length > 0 && (
            <div className="comment-mentions-dropdown">
              {filteredCollaborators.map((c, idx) => (
                <div
                  key={c.userId}
                  className={`comment-mention-item ${idx === mentionIndex ? 'selected' : ''}`}
                  onClick={() => insertMention(c.username)}
                >
                  <span className="comment-mention-item-name">{c.fullName}</span>
                  <span className="comment-mention-item-user">@{c.username}</span>
                </div>
              ))}
            </div>
          )}

          <div className="comment-textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="comment-textarea"
              placeholder={isDraft ? 'Leave a comment… (type @ to mention)' : 'Reply…'}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDownInput}
              rows={2}
            />
          </div>

          <div className="comment-input-footer">
            <span className="comment-mention-hint">
              <kbd>@</kbd> mention · <kbd>⌘Enter</kbd> send
            </span>
            <button
              type="button"
              className="comment-submit-btn"
              onClick={handleSubmit}
              disabled={loading || !inputText.trim()}
            >
              <IconSend size={12} />
              <span>{isDraft ? 'Comment' : 'Reply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
