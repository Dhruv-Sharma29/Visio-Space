import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Card, Shape, Cluster, TextItem, CommentItem, SearchMatch, SearchMatchCategory, Viewport } from '../../types/board.ts';
import { searchService } from '../../services/searchService.ts';
import { IconSearch } from '../Icons/Icons.tsx';
import './CanvasSearchBar.css';

interface CanvasSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  shapes: Shape[];
  clusters: Cluster[];
  textItems: TextItem[];
  comments?: CommentItem[];
  viewport: Viewport;
  onNavigateToMatch: (match: SearchMatch) => void;
}

export const CanvasSearchBar: React.FC<CanvasSearchBarProps> = ({
  isOpen,
  onClose,
  cards,
  shapes,
  clusters,
  textItems,
  comments = [],
  viewport,
  onNavigateToMatch,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | SearchMatchCategory>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setCurrentIndex(0);
    }
  }, [isOpen]);

  // Build search index & matches
  const matches = useMemo<SearchMatch[]>(() => {
    return searchService.searchCanvas({
      query,
      category,
      cards,
      shapes,
      clusters,
      textItems,
      comments,
    });
  }, [query, category, cards, shapes, clusters, textItems, comments]);

  // Navigate to current match
  const goToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const normalizedIndex = (index + matches.length) % matches.length;
      setCurrentIndex(normalizedIndex);
      onNavigateToMatch(matches[normalizedIndex]);
    },
    [matches, onNavigateToMatch]
  );

  // Trigger camera pan when first match appears
  useEffect(() => {
    if (matches.length > 0) {
      setCurrentIndex(0);
      onNavigateToMatch(matches[0]);
    }
  }, [query, category]); // only on query/filter change

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToMatch(currentIndex - 1);
      } else {
        goToMatch(currentIndex + 1);
      }
    }
  };

  if (!isOpen) return null;

  const currentMatch = matches[currentIndex];

  return (
    <>
      {/* Visual Glowing Ring over Konva Canvas for current targeted match */}
      {currentMatch && (
        <div
          className="canvas-search-glow-ring"
          style={{
            left: currentMatch.x * viewport.scale + viewport.x - 4,
            top: currentMatch.y * viewport.scale + viewport.y - 4,
            width: (currentMatch.width || 100) * viewport.scale + 8,
            height: (currentMatch.height || 100) * viewport.scale + 8,
          }}
        />
      )}

      {/* Search Bar Panel */}
      <div className="canvas-search-overlay" role="search" aria-label="Canvas Search">
        <div className="canvas-search-header">
          <span className="canvas-search-icon">
            <IconSearch size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="canvas-search-input"
            placeholder="Search cards, shapes, text, comments… (Cmd+F)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <span className="canvas-search-count">
              {matches.length > 0 ? `${currentIndex + 1} of ${matches.length}` : '0 results'}
            </span>
          )}
          <button
            type="button"
            className="canvas-search-nav-btn"
            title="Previous match (Shift+Enter)"
            disabled={matches.length <= 1}
            onClick={() => goToMatch(currentIndex - 1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="canvas-search-nav-btn"
            title="Next match (Enter)"
            disabled={matches.length <= 1}
            onClick={() => goToMatch(currentIndex + 1)}
          >
            ▼
          </button>
          <button
            type="button"
            className="canvas-search-close-btn"
            title="Close search (Esc)"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Filter Pills */}
        <div className="canvas-search-filters">
          {(['all', 'card', 'shape', 'cluster', 'comment'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`canvas-search-filter-pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' && 'All'}
              {cat === 'card' && 'Cards'}
              {cat === 'shape' && 'Shapes'}
              {cat === 'cluster' && 'Groups'}
              {cat === 'comment' && 'Comments'}
            </button>
          ))}
        </div>

        {/* Results List */}
        {matches.length > 0 && (
          <div className="canvas-search-results">
            {matches.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className={`canvas-search-item ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => goToMatch(idx)}
              >
                <div className="canvas-search-item-header">
                  <span className="canvas-search-item-title">{item.title}</span>
                  <span className="canvas-search-item-badge">{item.category}</span>
                </div>
                {item.snippet && (
                  <span className="canvas-search-item-snippet">{item.snippet}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
