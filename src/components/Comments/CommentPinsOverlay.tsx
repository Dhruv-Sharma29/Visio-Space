import React, { useEffect, useState } from 'react';
import type { Card, CommentItem, Viewport } from '../../types/board.ts';
import { commentService } from '../../services/commentService.ts';
import { realtimeService } from '../../services/realtimeService.ts';
import { IconCheck } from '../Icons/Icons.tsx';
import './CommentPinsOverlay.css';

interface CommentPinsOverlayProps {
  boardId: string;
  viewport: Viewport;
  cards: Card[];
  activeCommentId: string | null;
  onSelectComment: (commentId: string | null) => void;
  showResolved?: boolean;
}

export const CommentPinsOverlay: React.FC<CommentPinsOverlayProps> = ({
  boardId,
  viewport,
  cards,
  activeCommentId,
  onSelectComment,
  showResolved = false,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);

  const loadComments = React.useCallback(async () => {
    if (!boardId) return;
    const items = await commentService.getBoardComments(boardId);
    setComments(items);
  }, [boardId]);

  useEffect(() => {
    loadComments();

    // Subscribe to realtime comment updates from peers
    const unsubscribe = realtimeService.onCommentUpdate(() => {
      loadComments();
    });

    return () => {
      unsubscribe();
    };
  }, [boardId, loadComments]);

  if (comments.length === 0) return null;

  return (
    <div className="comment-pins-overlay" aria-label="Comment pins">
      {comments.map((comment) => {
        // If resolved and filter is off, don't show unless active
        if (comment.resolved && !showResolved && comment.id !== activeCommentId) {
          return null;
        }

        // Calculate location: card-anchored or free canvas
        let posX = comment.x;
        let posY = comment.y;

        if (comment.cardId) {
          const card = cards.find(c => c.id === comment.cardId);
          if (card) {
            posX = card.x + card.width - 18;
            posY = card.y - 12;
          }
        }

        // Project canvas coordinate to viewport screen coordinate
        const screenX = posX * viewport.scale + viewport.x;
        const screenY = posY * viewport.scale + viewport.y;

        const isActive = comment.id === activeCommentId;
        const initial = (comment.authorName || 'C').charAt(0).toUpperCase();
        const replyCount = comment.replies?.length || 0;

        return (
          <div
            key={comment.id}
            className={`comment-pin ${isActive ? 'active' : ''} ${comment.resolved ? 'resolved' : ''}`}
            style={{
              transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComment(isActive ? null : comment.id);
            }}
            title={`${comment.authorName}: ${comment.body.slice(0, 40)}${comment.body.length > 40 ? '…' : ''}`}
          >
            <div className="comment-pin-bubble">
              {comment.authorAvatar ? (
                <img
                  src={comment.authorAvatar}
                  alt={comment.authorName}
                  className="comment-pin-avatar"
                />
              ) : (
                <span className="comment-pin-initial">{initial}</span>
              )}

              {replyCount > 0 && (
                <span className="comment-pin-badge">{replyCount}</span>
              )}

              {comment.resolved && (
                <span className="comment-pin-resolved-icon">
                  <IconCheck size={10} color="#4ade80" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
