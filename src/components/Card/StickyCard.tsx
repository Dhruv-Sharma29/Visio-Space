import React, { useMemo, useRef, useCallback } from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { Card } from '../../types/board';
import { CARD_COLORS } from '../../types/board';
import { useBoardStore } from '../../store/boardStore';

interface StickyCardProps {
  card: Card;
  isSelected: boolean;
  isEditing: boolean;
  isConnecting: boolean;
  isConnectingSource: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
}

const PIN_RADIUS = 8;
const CORNER_RADIUS = 2;
const CARD_PADDING = 14;
const EYEBROW_FONT_SIZE = 9.5;
const TITLE_FONT_SIZE = 15;
const BODY_FONT_SIZE = 11.5;
const TITLE_LINE_HEIGHT = 1.3;
const BODY_LINE_HEIGHT = 1.5;

// Fixed card height — all cards render at this height regardless of content
const FIXED_CARD_HEIGHT = 140;

// Maximum lines for text truncation
const MAX_TITLE_LINES = 2;
const MAX_BODY_LINES = 3;

export const StickyCard: React.FC<StickyCardProps> = ({
  card,
  isSelected,
  isEditing,
  isConnecting,
  isConnectingSource,
  onSelect,
  onDragStart,
  onDragEnd,
  onDoubleClick,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const shadowRectRef = useRef<Konva.Rect>(null);
  const lastDragPos = useRef({ x: card.x, y: card.y });
  const colors = CARD_COLORS[card.color];
  
  const displayTitle = card.title || 'Double-click to edit';
  const displayBody = card.body || '';
  const displayEyebrow = card.eyebrow || '';

  // Use fixed card height
  const cardHeight = FIXED_CARD_HEIGHT;

  // Build text Y positions
  let textY = CARD_PADDING;
  const eyebrowY = textY;
  if (displayEyebrow) {
    textY += EYEBROW_FONT_SIZE * 1.2 + 6;
  }
  const titleY = textY;
  const availableW = Math.max(20, card.width - CARD_PADDING * 2);

  // Capped title height (max 2 lines)
  const titleMaxH = MAX_TITLE_LINES * TITLE_FONT_SIZE * TITLE_LINE_HEIGHT;
  const bodyY = titleY + titleMaxH + 8;

  // Available height for body text (remaining space within fixed card)
  const bodyMaxH = Math.max(0, cardHeight - bodyY - CARD_PADDING);

  // Check if content might be truncated (rough heuristic)
  const isTruncated = useMemo(() => {
    const titleCharsPerLine = Math.max(1, Math.floor(availableW / (TITLE_FONT_SIZE * 0.52)));
    const titleLines = Math.ceil(displayTitle.length / titleCharsPerLine);

    if (titleLines > MAX_TITLE_LINES) return true;

    if (displayBody) {
      const bodyCharsPerLine = Math.max(1, Math.floor(availableW / (BODY_FONT_SIZE * 0.48)));
      const bodyLines = Math.ceil(displayBody.length / bodyCharsPerLine);
      if (bodyLines > MAX_BODY_LINES) return true;
    }

    return false;
  }, [displayTitle, displayBody, availableW]);

  // Pin positions (top center)
  const pinX = card.width / 2;
  const pinY = -PIN_RADIUS + 2;

  // Hover alignment & exact paper shadow matching the sensemaking gap reference
  const handleMouseEnter = useCallback(() => {
    const layer = groupRef.current?.getLayer();
    if (groupRef.current) {
      groupRef.current.to({
        rotation: 0,
        scaleX: 1.035,
        scaleY: 1.035,
        duration: 0.2,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
    if (shadowRectRef.current) {
      shadowRectRef.current.to({
        x: 6,
        y: 12,
        shadowBlur: 18,
        shadowOffsetX: 6,
        shadowOffsetY: 12,
        shadowOpacity: 0.48,
        duration: 0.2,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const layer = groupRef.current?.getLayer();
    if (groupRef.current) {
      groupRef.current.to({
        rotation: card.rotation,
        scaleX: 1,
        scaleY: 1,
        duration: 0.2,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
    if (shadowRectRef.current) {
      shadowRectRef.current.to({
        x: 3,
        y: 6,
        shadowBlur: 10,
        shadowOffsetX: 3,
        shadowOffsetY: 6,
        shadowOpacity: 0.32,
        duration: 0.2,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
  }, [card.rotation]);

  const handleDragStart = useCallback(() => {
    lastDragPos.current = { x: card.x, y: card.y };
    onDragStart(card.id);
    const layer = groupRef.current?.getLayer();
    if (groupRef.current) {
      groupRef.current.to({
        rotation: 0,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
    if (shadowRectRef.current) {
      shadowRectRef.current.to({
        x: 8,
        y: 16,
        shadowBlur: 22,
        shadowOffsetX: 8,
        shadowOffsetY: 16,
        shadowOpacity: 0.55,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
  }, [card.id, card.x, card.y, onDragStart]);

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const store = useBoardStore.getState();
    if (store.selectedIds.includes(card.id) && store.selectedIds.length > 1) {
      const dx = node.x() - lastDragPos.current.x;
      const dy = node.y() - lastDragPos.current.y;
      lastDragPos.current = { x: node.x(), y: node.y() };
      const otherIds = store.selectedIds.filter(id => id !== card.id);
      store.moveMultipleItems(dx, dy, otherIds);
    }
  }, [card.id]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      onDragEnd(card.id, node.x(), node.y());
      handleMouseLeave();
    },
    [card.id, onDragEnd, handleMouseLeave]
  );

  return (
    <Group
      ref={groupRef}
      id={card.id}
      x={card.x}
      y={card.y}
      rotation={card.rotation}
      draggable={!isEditing}
      onClick={(e) => onSelect(card.id, e)}
      onTap={(e) => onSelect(card.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
      onDblClick={() => onDoubleClick(card.id)}
      onDblTap={() => onDoubleClick(card.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        window.dispatchEvent(
          new CustomEvent('canvas-context-menu', {
            detail: {
              clientX: e.evt.clientX,
              clientY: e.evt.clientY,
              targetId: card.id,
            },
          })
        );
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Exact paper drop shadow matching reference image */}
      <Rect
        ref={shadowRectRef}
        x={3}
        y={6}
        width={card.width}
        height={cardHeight}
        cornerRadius={CORNER_RADIUS}
        fill="rgba(20, 10, 5, 0.22)"
        shadowColor="rgba(20, 10, 5, 0.45)"
        shadowBlur={10}
        shadowOffsetX={3}
        shadowOffsetY={6}
        shadowOpacity={0.32}
        listening={false}
      />

      {/* Card body — uses clipping to prevent text overflow */}
      <Group
        clipX={0}
        clipY={0}
        clipWidth={card.width}
        clipHeight={cardHeight}
      >
        <Rect
          width={card.width}
          height={cardHeight}
          fill={colors.bg}
          stroke={isSelected ? '#c0392b' : colors.border}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={CORNER_RADIUS}
        />

        {/* Color stripe on left edge */}
        <Rect
          x={0}
          y={0}
          width={4}
          height={cardHeight}
          fill={colors.pin}
          cornerRadius={[CORNER_RADIUS, 0, 0, CORNER_RADIUS]}
          listening={false}
        />

        {/* Eyebrow text */}
        {displayEyebrow && (
          <Text
            x={CARD_PADDING}
            y={eyebrowY}
            width={card.width - CARD_PADDING * 2}
            text={displayEyebrow.toUpperCase()}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={EYEBROW_FONT_SIZE}
            fontStyle="bold"
            letterSpacing={1.4}
            fill={colors.eyebrow}
            wrap="char"
            ellipsis={true}
            height={EYEBROW_FONT_SIZE * 1.2}
            listening={false}
          />
        )}

        {/* Title — capped at MAX_TITLE_LINES */}
        <Text
          x={CARD_PADDING}
          y={titleY}
          width={card.width - CARD_PADDING * 2}
          height={titleMaxH}
          text={displayTitle}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={TITLE_FONT_SIZE}
          fontStyle={card.title ? 'bold' : 'normal'}
          lineHeight={TITLE_LINE_HEIGHT}
          fill={card.title ? '#241d18' : '#8a7d6f'}
          wrap="char"
          ellipsis={true}
          listening={false}
        />

        {/* Body text — capped to fit remaining space */}
        {displayBody && bodyMaxH > 0 && (
          <Text
            x={CARD_PADDING}
            y={bodyY}
            width={card.width - CARD_PADDING * 2}
            height={bodyMaxH}
            text={displayBody}
            fontFamily="'Courier New', monospace"
            fontSize={BODY_FONT_SIZE}
            lineHeight={BODY_LINE_HEIGHT}
            fill="#5a4f42"
            wrap="char"
            ellipsis={true}
            listening={false}
          />
        )}

        {/* Truncation fade gradient at bottom */}
        {isTruncated && (
          <Rect
            x={0}
            y={cardHeight - 22}
            width={card.width}
            height={22}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: 22 }}
            fillLinearGradientColorStops={[0, `${colors.bg}00`, 0.6, `${colors.bg}cc`, 1, colors.bg]}
            listening={false}
          />
        )}
      </Group>

      {/* Selection glow */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={card.width + 6}
          height={cardHeight + 6}
          cornerRadius={4}
          stroke="#c0392b"
          strokeWidth={2}
          dash={[6, 3]}
          listening={false}
        />
      )}

      {/* Connecting source indicator */}
      {isConnectingSource && (
        <Rect
          x={-4}
          y={-4}
          width={card.width + 8}
          height={cardHeight + 8}
          cornerRadius={5}
          stroke="#2f4a63"
          strokeWidth={2.5}
          dash={[8, 4]}
          listening={false}
        />
      )}

      {/* Connector mode hover hint */}
      {isConnecting && !isConnectingSource && (
        <Rect
          x={-2}
          y={-2}
          width={card.width + 4}
          height={cardHeight + 4}
          cornerRadius={3}
          fill="rgba(47, 74, 99, 0.06)"
          listening={false}
        />
      )}

      {/* Push pin shadow */}
      <Circle
        x={pinX}
        y={pinY + 3}
        radius={PIN_RADIUS}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />

      {/* Push pin */}
      <Circle
        x={pinX}
        y={pinY}
        radius={PIN_RADIUS}
        fillRadialGradientStartPoint={{ x: -2, y: -2 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={PIN_RADIUS}
        fillRadialGradientColorStops={[0, lightenColor(colors.pin, 30), 1, colors.pin]}
        listening={false}
      />

      {/* Pin highlight */}
      <Circle
        x={pinX - 2}
        y={pinY - 2}
        radius={3}
        fill="rgba(255,255,255,0.35)"
        listening={false}
      />

      {/* Tape decoration (subtle strip at top) */}
      <Line
        points={[CARD_PADDING + 20, 0, card.width - CARD_PADDING - 20, 0]}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
        listening={false}
      />
    </Group>
  );
};

// ─── Helper ─────────────────────────────────────────────────────────
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r},${g},${b})`;
}
