import React, { useRef, useEffect, useCallback } from 'react';
import { Group, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import type { Shape } from '../../types/board';
import { SHAPE_COLORS } from '../../types/board';
import { getShapeDefinition } from './shapeRegistry';
import { useBoardStore } from '../../store/boardStore';


interface ShapeNodeProps {
  shape: Shape;
  isSelected: boolean;
  isEditing: boolean;
  isConnecting: boolean;
  isConnectingSource: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (
    id: string,
    width: number,
    height: number,
    x: number,
    y: number,
    rotation: number
  ) => void;
  onDoubleClick: (id: string) => void;
}

// Calculate shape-specific inner text bounding box so text never touches or spills over shape edges
function getShapeInnerBounds(
  shapeType: string,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  switch (shapeType) {
    case 'circle': {
      // Inscribed rectangle in ellipse: w * 0.7, h * 0.7
      const innerW = Math.max(10, width * 0.7);
      const innerH = Math.max(10, height * 0.7);
      return {
        x: (width - innerW) / 2,
        y: (height - innerH) / 2,
        width: innerW,
        height: innerH,
      };
    }
    case 'triangle': {
      // Triangle text fits best in the lower-middle half
      const innerW = Math.max(10, width * 0.55);
      const innerH = Math.max(10, height * 0.48);
      return {
        x: (width - innerW) / 2,
        y: height * 0.38,
        width: innerW,
        height: innerH,
      };
    }
    case 'diamond': {
      // Diamond inscribed rectangle: w * 0.5, h * 0.5
      const innerW = Math.max(10, width * 0.5);
      const innerH = Math.max(10, height * 0.5);
      return {
        x: (width - innerW) / 2,
        y: (height - innerH) / 2,
        width: innerW,
        height: innerH,
      };
    }
    case 'star': {
      // Star center core
      const innerW = Math.max(10, width * 0.42);
      const innerH = Math.max(10, height * 0.42);
      return {
        x: (width - innerW) / 2,
        y: (height - innerH) / 2 + height * 0.04,
        width: innerW,
        height: innerH,
      };
    }
    case 'hexagon': {
      const innerW = Math.max(10, width * 0.66);
      const innerH = Math.max(10, height * 0.7);
      return {
        x: (width - innerW) / 2,
        y: (height - innerH) / 2,
        width: innerW,
        height: innerH,
      };
    }
    case 'rectangle':
    default: {
      const padX = Math.max(8, width * 0.08);
      const padY = Math.max(6, height * 0.08);
      return {
        x: padX,
        y: padY,
        width: Math.max(10, width - padX * 2),
        height: Math.max(10, height - padY * 2),
      };
    }
  }
}

// Dynamically compute optimal font size to fit text within inner bounds
function computeOptimalFontSize(text: string, innerW: number, innerH: number): number {
  if (!text) return 13;
  const len = text.length;

  // Base font size roughly proportional to shape size
  let size = Math.min(18, Math.max(9, Math.round(Math.min(innerW, innerH) / 5)));

  // If text is long, scale down appropriately
  const estCharsPerLine = Math.max(1, innerW / (size * 0.55));
  const estLines = Math.ceil(len / estCharsPerLine);
  const estTotalHeight = estLines * size * 1.3;

  if (estTotalHeight > innerH || len > 25) {
    const area = innerW * innerH;
    const scaleFactor = Math.sqrt(area / (len * 14));
    size = Math.min(size, Math.max(8, Math.round(scaleFactor)));
  }

  // Safety cap to guarantee fitting
  const maxLinesAllowed = Math.floor(innerH / (size * 1.2));
  if (maxLinesAllowed < 1) {
    size = Math.max(7, Math.floor(innerH / 1.3));
  }

  return Math.min(16, Math.max(8, size));
}

// Detect touch/coarse pointer once at module level
const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

export const ShapeNode: React.FC<ShapeNodeProps> = ({
  shape,
  isSelected,
  isEditing,
  isConnecting: _isConnecting,
  isConnectingSource,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const lastDragPos = useRef({ x: shape.x, y: shape.y });

  const colors = SHAPE_COLORS[shape.color] || SHAPE_COLORS.cream;
  const def = getShapeDefinition(shape.type);

  // Attach Transformer when selected
  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, shape.width, shape.height, shape.rotation]);

  // Hover animation
  const handleMouseEnter = useCallback(() => {
    if (isEditing) return;
    const layer = groupRef.current?.getLayer();
    if (groupRef.current && !isSelected) {
      groupRef.current.to({
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 0.15,
        easing: (Konva.Easings as any).EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
  }, [isSelected, isEditing]);

  const handleMouseLeave = useCallback(() => {
    const layer = groupRef.current?.getLayer();
    if (groupRef.current && !isSelected) {
      groupRef.current.to({
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        easing: (Konva.Easings as any).EaseOut,
        onUpdate: () => layer?.batchDraw(),
      });
    }
  }, [isSelected]);

  const handleDragStart = useCallback(() => {
    lastDragPos.current = { x: shape.x, y: shape.y };
    onDragStart(shape.id);
  }, [shape.id, shape.x, shape.y, onDragStart]);

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const store = useBoardStore.getState();
    if (store.selectedIds.includes(shape.id) && store.selectedIds.length > 1) {
      const dx = node.x() - lastDragPos.current.x;
      const dy = node.y() - lastDragPos.current.y;
      lastDragPos.current = { x: node.x(), y: node.y() };
      const otherIds = store.selectedIds.filter(id => id !== shape.id);
      store.moveMultipleItems(dx, dy, otherIds);
    }
  }, [shape.id]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      onDragEnd(shape.id, node.x(), node.y());
      handleMouseLeave();
    },
    [shape.id, onDragEnd, handleMouseLeave]
  );

  const handleTransformEnd = useCallback(() => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(25, Math.round(shape.width * scaleX));
    const newHeight = Math.max(25, Math.round(shape.height * scaleY));
    const newX = Math.round(node.x());
    const newY = Math.round(node.y());
    const newRotation = Math.round(node.rotation());

    onTransformEnd(shape.id, newWidth, newHeight, newX, newY, newRotation);
  }, [shape.id, shape.width, shape.height, onTransformEnd]);

  // Center text calculation using shape-specific inner bounds
  const innerBounds = getShapeInnerBounds(shape.type, shape.width, shape.height);
  const displayText = shape.text || '';
  const fontSize = computeOptimalFontSize(displayText, innerBounds.width, innerBounds.height);

  return (
    <>
      <Group
        ref={groupRef}
        id={shape.id}
        x={shape.x}
        y={shape.y}
        rotation={shape.rotation}
        draggable={!isEditing}
        onClick={(e) => onSelect(shape.id, e)}
        onTap={(e) => onSelect(shape.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
        onDblClick={() => onDoubleClick(shape.id)}
        onDblTap={() => onDoubleClick(shape.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          window.dispatchEvent(
            new CustomEvent('canvas-context-menu', {
              detail: {
                clientX: e.evt.clientX,
                clientY: e.evt.clientY,
                targetId: shape.id,
              },
            })
          );
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {/* Custom Konva Shape Geometry */}
        {def.renderKonvaShape({
          shape,
          fill: colors.bg,
          stroke: isSelected ? '#c0392b' : isConnectingSource ? '#2f4a63' : colors.border,
          strokeWidth: isSelected ? 2 : isConnectingSource ? 2.5 : 1.5,
          width: shape.width,
          height: shape.height,
        })}

        {/* Text inside shape - precisely constrained to innerBounds with wrap='char' and ellipsis */}
        {displayText ? (
          <Text
            x={innerBounds.x}
            y={innerBounds.y}
            width={innerBounds.width}
            height={innerBounds.height}
            text={displayText}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={fontSize}
            lineHeight={1.25}
            fill={colors.text}
            align="center"
            verticalAlign="middle"
            wrap="char"
            ellipsis={true}
            listening={false}
          />
        ) : isSelected ? (
          <Text
            x={innerBounds.x}
            y={innerBounds.y}
            width={innerBounds.width}
            height={innerBounds.height}
            text="Double-click to type"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={Math.max(9, fontSize - 2)}
            fill="rgba(0, 0, 0, 0.28)"
            fontStyle="italic"
            align="center"
            verticalAlign="middle"
            wrap="char"
            ellipsis={true}
            listening={false}
          />
        ) : null}
      </Group>

      {/* Transformer for resizing and rotating when selected */}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 25 || newBox.height < 25) {
              return oldBox;
            }
            return newBox;
          }}
          anchorSize={IS_TOUCH_DEVICE ? 14 : 8}
          anchorCornerRadius={2}
          anchorFill="#ffffff"
          anchorStroke="#c0392b"
          anchorStrokeWidth={1.5}
          borderEnabled={false}
          rotateAnchorOffset={20}
          keepRatio={false}
        />
      )}
    </>
  );
};
