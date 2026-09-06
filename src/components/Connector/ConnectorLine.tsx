import React from 'react';
import { Line, Group, Rect, Text } from 'react-konva';
import type { Connector, Card, Shape } from '../../types/board';
import { CONNECTOR_COLORS } from '../../types/board';
import { useBoardStore } from '../../store/boardStore';

interface ConnectorLineProps {
  connector: Connector;
  fromItem: Card | Shape;
  toItem: Card | Shape;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

// Calculate smart anchor point on source edge closest to target
function getSmartAnchor(source: Card | Shape, target: Card | Shape): { x: number; y: number } {
  const srcCx = source.x + source.width / 2;
  const srcCy = source.y + source.height / 2;
  const tgtCx = target.x + target.width / 2;
  const tgtCy = target.y + target.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;

  // Horizontal dominance
  if (Math.abs(dx) > Math.abs(dy) * 1.1) {
    if (dx > 0) {
      // Connects from right edge
      return { x: source.x + source.width, y: srcCy };
    } else {
      // Connects from left edge
      return { x: source.x, y: srcCy };
    }
  } else {
    // Vertical dominance
    if (dy > 0) {
      // Connects from bottom edge
      return { x: srcCx, y: source.y + source.height };
    } else {
      // Connects from top pin
      return { x: srcCx, y: source.y - 4 };
    }
  }
}

// Compute catenary-like droopy curve between two anchor points
function computeCurvePoints(
  x1: number, y1: number,
  x2: number, y2: number,
): { points: number[]; midX: number; midY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let droopX = 0;
  let droopY = 0;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal span: natural downward gravitational droop
    droopY = Math.min(dist * 0.16, 45);
  } else {
    // Vertical span: slight organic lateral curve
    droopX = (dx >= 0 ? 1 : -1) * Math.min(dist * 0.12, 35);
  }

  const mx = (x1 + x2) / 2 + droopX;
  const my = (y1 + y2) / 2 + droopY;

  const points: number[] = [];
  const steps = 20;
  let midX = mx;
  let midY = my;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    points.push(px, py);
    if (i === 10) {
      midX = px;
      midY = py;
    }
  }
  return { points, midX, midY };
}

export const ConnectorLine: React.FC<ConnectorLineProps> = ({
  connector,
  fromItem,
  toItem,
  isSelected,
  onSelect,
}) => {
  const p1 = getSmartAnchor(fromItem, toItem);
  const p2 = getSmartAnchor(toItem, fromItem);

  const { points, midX, midY } = computeCurvePoints(p1.x, p1.y, p2.x, p2.y);
  const strokeColor = CONNECTOR_COLORS[connector.color] || '#c0392b';
  const { setEditingConnectorId } = useBoardStore();

  const handleDoubleClick = (e: any) => {
    if (e) e.cancelBubble = true;
    setEditingConnectorId(connector.id);
  };

  // Badge sizing calculation
  const labelText = connector.label || '';
  const fontSize = 11;
  const badgePadX = 10;
  const badgePadY = 5;
  const badgeWidth = Math.max(48, labelText.length * 7 + badgePadX * 2);
  const badgeHeight = fontSize + badgePadY * 2 + 2;

  return (
    <Group id={connector.id}>
      {/* Invisible wider line for easy selection / hover / click */}
      <Line
        points={points}
        stroke="transparent"
        strokeWidth={20}
        onClick={() => onSelect(connector.id)}
        onTap={() => onSelect(connector.id)}
        onDblClick={handleDoubleClick}
        onDblTap={handleDoubleClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          window.dispatchEvent(
            new CustomEvent('canvas-context-menu', {
              detail: {
                clientX: e.evt.clientX,
                clientY: e.evt.clientY,
                targetId: connector.id,
              },
            })
          );
        }}
        hitStrokeWidth={24}
      />

      {/* Visible string shadow for realistic 3D depth */}
      <Line
        points={points}
        stroke="rgba(0, 0, 0, 0.18)"
        strokeWidth={isSelected ? 3.5 : 2.5}
        x={1.5}
        y={2}
        opacity={0.5}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />

      {/* Visible connector line */}
      <Line
        points={points}
        stroke={strokeColor}
        strokeWidth={isSelected ? 3 : 2.2}
        opacity={isSelected ? 1 : 0.9}
        dash={connector.style === 'dashed' ? [8, 4] : undefined}
        lineCap="round"
        lineJoin="round"
        listening={false}
        shadowColor={isSelected ? strokeColor : undefined}
        shadowBlur={isSelected ? 10 : 0}
        shadowOpacity={0.6}
      />

      {/* Midpoint Label Tag (textbox over yarn) */}
      {labelText && (
        <Group
          x={midX - badgeWidth / 2}
          y={midY - badgeHeight / 2}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelect(connector.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onSelect(connector.id);
          }}
          onDblClick={handleDoubleClick}
          onDblTap={handleDoubleClick}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            e.cancelBubble = true;
            window.dispatchEvent(
              new CustomEvent('canvas-context-menu', {
                detail: {
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  targetId: connector.id,
                },
              })
            );
          }}
        >
          {/* Paper tag shadow */}
          <Rect
            x={1.5}
            y={2}
            width={badgeWidth}
            height={badgeHeight}
            fill="rgba(0, 0, 0, 0.22)"
            cornerRadius={4}
            shadowBlur={4}
            shadowOpacity={0.25}
            listening={false}
          />

          {/* Paper tag body */}
          <Rect
            width={badgeWidth}
            height={badgeHeight}
            fill="#fffdfa"
            stroke={isSelected ? strokeColor : '#cfbfad'}
            strokeWidth={isSelected ? 1.8 : 1.2}
            cornerRadius={4}
          />

          {/* Mini pin dot on the tag */}
          <Rect
            x={4}
            y={badgeHeight / 2 - 2}
            width={4}
            height={4}
            fill={strokeColor}
            cornerRadius={2}
            listening={false}
          />

          {/* Label text */}
          <Text
            x={badgePadX + 2}
            y={badgePadY + 1}
            text={labelText}
            fontFamily="'Courier New', monospace"
            fontSize={fontSize}
            fontStyle="bold"
            letterSpacing={0.5}
            fill={isSelected ? strokeColor : '#3d3228'}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
};
