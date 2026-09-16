import React from 'react';
import { Line, Group, Rect, Text, Circle } from 'react-konva';
import type { Connector, Card, Shape } from '../../types/board';
import { CONNECTOR_COLORS } from '../../types/board';
import { useBoardStore } from '../../store/boardStore';
import { getSmartAnchor, pointBox } from '../../utils/connectorGeometry';

interface ConnectorLineProps {
  connector: Connector;
  fromItem: Card | Shape | null;
  toItem: Card | Shape | null;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEndpointDrag?: (end: 'from' | 'to', point: { x: number; y: number }) => void;
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
  onEndpointDrag,
}) => {
  const fromBox = fromItem ?? pointBox(connector.fromPoint!);
  const toBox = toItem ?? pointBox(connector.toPoint!);

  const p1 = fromItem ? getSmartAnchor(fromBox, toBox) : connector.fromPoint!;
  const p2 = toItem ? getSmartAnchor(toBox, fromBox) : connector.toPoint!;

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

      {/* Free-floating endpoint handles — draggable to reposition a detached end */}
      {isSelected && !fromItem && (
        <Circle
          x={p1.x}
          y={p1.y}
          radius={6}
          fill="#fffdfa"
          stroke={strokeColor}
          strokeWidth={2}
          draggable
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onEndpointDrag?.('from', { x: e.target.x(), y: e.target.y() });
          }}
          onClick={(e) => { e.cancelBubble = true; onSelect(connector.id); }}
          onTap={(e) => { e.cancelBubble = true; onSelect(connector.id); }}
        />
      )}
      {isSelected && !toItem && (
        <Circle
          x={p2.x}
          y={p2.y}
          radius={6}
          fill="#fffdfa"
          stroke={strokeColor}
          strokeWidth={2}
          draggable
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onEndpointDrag?.('to', { x: e.target.x(), y: e.target.y() });
          }}
          onClick={(e) => { e.cancelBubble = true; onSelect(connector.id); }}
          onTap={(e) => { e.cancelBubble = true; onSelect(connector.id); }}
        />
      )}
    </Group>
  );
};
