import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Group, Text } from 'react-konva';
import type Konva from 'konva';
import { useBoardStore } from '../../store/boardStore';
import { setGlobalStageRef } from '../../utils/stageRef';
import { useTouchCanvas } from './useTouchCanvas';
import { StickyCard } from '../Card/StickyCard';
import { ShapeNode } from '../Shape/ShapeNode';
import { getShapeDefinition } from '../Shape/shapeRegistry';
import { ConnectorLine } from '../Connector/ConnectorLine';
import { ConnectorCreator } from '../Connector/ConnectorCreator';
import { ClusterLabel } from '../Cluster/ClusterLabel';
import { TextNode } from '../Text/TextNode';
import { VoteDotNode } from '../Vote/VoteDotNode';
import { ImageNode } from '../Image/ImageNode';

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.08;

// Dot grid settings
const DOT_SPACING = 30;
const DOT_RADIUS = 1.2;
const DOT_COLOR = 'rgba(0,0,0,0.08)';

export const InfiniteCanvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const isPanning = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });

  // Drag-to-draw state for clusters
  const [drawingClusterStart, setDrawingClusterStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingClusterCurrent, setDrawingClusterCurrent] = useState<{ x: number; y: number } | null>(null);

  // Drag-to-draw state for shapes
  const [drawingShapeStart, setDrawingShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingShapeCurrent, setDrawingShapeCurrent] = useState<{ x: number; y: number } | null>(null);

  // Marquee selection state
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  const {
    cards, shapes, connectors, clusters, textItems, voteDots, images,
    viewport, setViewport,
    activeTool, activeShapeType,
    selectedIds, setSelectedIds, clearSelection,
    addCard, moveCard, bringToFront,
    addShape, moveShape, resizeShape, bringShapeToFront,
    addCluster, moveCluster, resizeCluster, bringClusterToFront,
    editingCardId, setEditingCardId,
    setEditingTextId,
    editingShapeId, setEditingShapeId,
    setEditingClusterId,
    connectingFromId, setConnectingFromId,
    addConnector,
    setActiveTool,
    addTextItem, addVoteDot, moveTextItem, moveVoteDot,
    moveImage, bringImageToFront,
  } = useBoardStore();

  // Register stage ref globally for export
  useEffect(() => {
    if (stageRef.current) {
      setGlobalStageRef(stageRef.current);
    }
    return () => setGlobalStageRef(null);
  }, []);

  // Mobile touch interactions (pinch-zoom, two-finger pan, long-press, bg-tap)
  useTouchCanvas(stageRef);

  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Wheel zoom ──────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP)
      );

      setViewport({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [viewport, setViewport]
  );

  // ─── Stage mouse down (pan, place card, or start drawing shape/cluster) ───
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isBackgroundClick =
        e.target === e.currentTarget ||
        e.target.name() === 'background' ||
        e.target.name() === 'dot' ||
        e.target.name() === 'cluster-bg';

      if (!isBackgroundClick) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // World coordinates
      const worldX = (pointer.x - viewport.x) / viewport.scale;
      const worldY = (pointer.y - viewport.y) / viewport.scale;

      if (activeTool === 'card') {
        addCard(worldX - 110, worldY - 70);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'text') {
        const id = addTextItem(worldX, worldY);
        setEditingTextId(id);
        setActiveTool('select');
        return;
      }

      if (activeTool === 'vote') {
        addVoteDot(worldX, worldY);
        return;
      }

      if (activeTool === 'cluster') {
        setDrawingClusterStart({ x: worldX, y: worldY });
        setDrawingClusterCurrent({ x: worldX, y: worldY });
        return;
      }

      if (activeTool === 'shape') {
        setDrawingShapeStart({ x: worldX, y: worldY });
        setDrawingShapeCurrent({ x: worldX, y: worldY });
        return;
      }

      // Middle click or hand tool or space → pan
      if (e.evt.button === 1 || activeTool === 'hand') {
        isPanning.current = true;
        lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }

      // Left click on background in select mode → start rubber-band marquee
      if (e.evt.button === 0 && activeTool === 'select') {
        setMarqueeStart({ x: worldX, y: worldY });
        setMarqueeCurrent({ x: worldX, y: worldY });
        if (!e.evt.shiftKey) {
          clearSelection();
        }
        if (connectingFromId) {
          setConnectingFromId(null);
        }
      }
    },
    [activeTool, viewport, addCard, addTextItem, addVoteDot, clearSelection, connectingFromId, setConnectingFromId, setActiveTool, setEditingTextId]
  );

  // ─── Stage double click (instant card creation on canvas or inside cluster) ────
  const handleStageDblClick = useCallback(
    (e: Konva.KonvaEventObject<any>) => {
      const isBackgroundClick =
        e.target === e.currentTarget ||
        e.target.name() === 'background' ||
        e.target.name() === 'dot' ||
        e.target.name() === 'cluster-bg';

      if (!isBackgroundClick) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldX = (pointer.x - viewport.x) / viewport.scale;
      const worldY = (pointer.y - viewport.y) / viewport.scale;

      const newId = addCard(worldX - 110, worldY - 70);
      setSelectedIds([newId]);
      setEditingCardId(newId);
      setActiveTool('select');
    },
    [viewport, addCard, setSelectedIds, setEditingCardId, setActiveTool]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning.current) {
        const dx = e.evt.clientX - lastPointerPos.current.x;
        const dy = e.evt.clientY - lastPointerPos.current.y;
        lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        setViewport({
          x: viewport.x + dx,
          y: viewport.y + dy,
        });
        return;
      }

      // If drawing a cluster, update current drag point
      if (drawingClusterStart) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldX = (pointer.x - viewport.x) / viewport.scale;
        const worldY = (pointer.y - viewport.y) / viewport.scale;
        setDrawingClusterCurrent({ x: worldX, y: worldY });
        return;
      }

      // If drawing a shape, update the current drag point
      if (drawingShapeStart) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldX = (pointer.x - viewport.x) / viewport.scale;
        const worldY = (pointer.y - viewport.y) / viewport.scale;
        setDrawingShapeCurrent({ x: worldX, y: worldY });
        return;
      }

      // If dragging marquee selection, update current point
      if (marqueeStart) {
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const worldX = (pointer.x - viewport.x) / viewport.scale;
        const worldY = (pointer.y - viewport.y) / viewport.scale;
        setMarqueeCurrent({ x: worldX, y: worldY });
      }
    },
    [viewport, setViewport, drawingClusterStart, drawingShapeStart, marqueeStart]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;

    // Finish marquee selection if active
    if (marqueeStart && marqueeCurrent) {
      const startX = marqueeStart.x;
      const startY = marqueeStart.y;
      const currX = marqueeCurrent.x;
      const currY = marqueeCurrent.y;

      const boxX = Math.min(startX, currX);
      const boxY = Math.min(startY, currY);
      const boxW = Math.abs(currX - startX);
      const boxH = Math.abs(currY - startY);

      if (boxW > 8 || boxH > 8) {
        const selected: string[] = [];

        cards.forEach((c) => {
          if (c.x < boxX + boxW && c.x + c.width > boxX && c.y < boxY + boxH && c.y + c.height > boxY) {
            selected.push(c.id);
          }
        });

        shapes.forEach((s) => {
          if (s.x < boxX + boxW && s.x + s.width > boxX && s.y < boxY + boxH && s.y + s.height > boxY) {
            selected.push(s.id);
          }
        });

        clusters.forEach((cl) => {
          if (cl.x < boxX + boxW && cl.x + cl.width > boxX && cl.y < boxY + boxH && cl.y + cl.height > boxY) {
            selected.push(cl.id);
          }
        });

        textItems.forEach((text) => {
          if (text.x < boxX + boxW && text.x + text.width > boxX && text.y < boxY + boxH && text.y + text.fontSize * 2 > boxY) {
            selected.push(text.id);
          }
        });

        voteDots.forEach((dot) => {
          if (dot.x + 12 > boxX && dot.x - 12 < boxX + boxW && dot.y + 12 > boxY && dot.y - 12 < boxY + boxH) {
            selected.push(dot.id);
          }
        });

        images.forEach((image) => {
          if (image.x < boxX + boxW && image.x + image.width > boxX && image.y < boxY + boxH && image.y + image.height > boxY) {
            selected.push(image.id);
          }
        });

        if (selected.length > 0) {
          setSelectedIds(selected);
        }
      }

      setMarqueeStart(null);
      setMarqueeCurrent(null);
    }

    // Finish drawing cluster if active
    if (drawingClusterStart && drawingClusterCurrent) {
      const startX = drawingClusterStart.x;
      const startY = drawingClusterStart.y;
      const currentX = drawingClusterCurrent.x;
      const currentY = drawingClusterCurrent.y;

      const dragWidth = Math.abs(currentX - startX);
      const dragHeight = Math.abs(currentY - startY);

      let finalId = '';
      if (dragWidth < 15 && dragHeight < 15) {
        const defaultW = 320;
        const defaultH = 220;
        finalId = addCluster(startX - defaultW / 2, startY - defaultH / 2, defaultW, defaultH);
      } else {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.max(100, dragWidth);
        const height = Math.max(80, dragHeight);
        finalId = addCluster(x, y, width, height);
      }

      if (finalId) {
        setSelectedIds([finalId]);
      }
      setDrawingClusterStart(null);
      setDrawingClusterCurrent(null);
      setActiveTool('select');
    }

    // Finish drawing shape if active
    if (drawingShapeStart && drawingShapeCurrent) {
      const startX = drawingShapeStart.x;
      const startY = drawingShapeStart.y;
      const currentX = drawingShapeCurrent.x;
      const currentY = drawingShapeCurrent.y;

      const dragWidth = Math.abs(currentX - startX);
      const dragHeight = Math.abs(currentY - startY);

      const shapeDef = getShapeDefinition(activeShapeType);

      let finalId = '';
      if (dragWidth < 15 && dragHeight < 15) {
        const defaultW = shapeDef.defaultWidth;
        const defaultH = shapeDef.defaultHeight;
        finalId = addShape(activeShapeType, startX - defaultW / 2, startY - defaultH / 2, defaultW, defaultH);
      } else {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.max(30, dragWidth);
        const height = Math.max(30, dragHeight);
        finalId = addShape(activeShapeType, x, y, width, height);
      }

      if (finalId) {
        setSelectedIds([finalId]);
      }
      setDrawingShapeStart(null);
      setDrawingShapeCurrent(null);
      setActiveTool('select');
    }
  }, [marqueeStart, marqueeCurrent, cards, shapes, clusters, textItems, voteDots, images, drawingClusterStart, drawingClusterCurrent, drawingShapeStart, drawingShapeCurrent, activeShapeType, addCluster, addShape, setSelectedIds, setActiveTool]);

  // ─── Card interaction handlers ───────────────────────────────────
  const handleCardSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'connector') {
        if (!connectingFromId) {
          setConnectingFromId(id);
        } else if (connectingFromId !== id) {
          addConnector(connectingFromId, id);
          setConnectingFromId(null);
        }
        return;
      }
      if (e.evt.shiftKey) {
        const store = useBoardStore.getState();
        store.toggleSelection(id);
      } else {
        setSelectedIds([id]);
      }
      bringToFront(id);
    },
    [activeTool, connectingFromId, setConnectingFromId, addConnector, setSelectedIds, bringToFront]
  );

  const handleCardDragStart = useCallback(
    (id: string) => {
      const store = useBoardStore.getState();
      store.pushHistory();
      bringToFront(id);
    },
    [bringToFront]
  );

  const handleCardDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      moveCard(id, x, y);
    },
    [moveCard]
  );

  const handleCardDoubleClick = useCallback(
    (id: string) => {
      useBoardStore.getState().setViewingCardId(id);
    },
    []
  );

  const handleTextSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey) useBoardStore.getState().toggleSelection(id);
    else setSelectedIds([id]);
  }, [setSelectedIds]);

  const handleTextEdit = useCallback((id: string) => setEditingTextId(id), [setEditingTextId]);

  const handleVoteSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey) useBoardStore.getState().toggleSelection(id);
    else setSelectedIds([id]);
  }, [setSelectedIds]);

  const handleImageSelect = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey) useBoardStore.getState().toggleSelection(id);
    else setSelectedIds([id]);
    bringImageToFront(id);
  }, [setSelectedIds, bringImageToFront]);

  const handleImageDragStart = useCallback((id: string) => {
    useBoardStore.getState().pushHistory();
    bringImageToFront(id);
  }, [bringImageToFront]);

  const handleImageTransformEnd = useCallback((id: string, width: number, height: number, x: number, y: number, rotation: number) => {
    useBoardStore.getState().updateImage(id, { width, height, x, y, rotation });
  }, []);

  // ─── Shape interaction handlers ──────────────────────────────────
  const handleShapeSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'connector') {
        if (!connectingFromId) {
          setConnectingFromId(id);
        } else if (connectingFromId !== id) {
          addConnector(connectingFromId, id);
          setConnectingFromId(null);
        }
        return;
      }
      if (e.evt.shiftKey) {
        const store = useBoardStore.getState();
        store.toggleSelection(id);
      } else {
        setSelectedIds([id]);
      }
      bringShapeToFront(id);
    },
    [activeTool, connectingFromId, setConnectingFromId, addConnector, setSelectedIds, bringShapeToFront]
  );

  const handleShapeDragStart = useCallback(
    (id: string) => {
      const store = useBoardStore.getState();
      store.pushHistory();
      bringShapeToFront(id);
    },
    [bringShapeToFront]
  );

  const handleShapeDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      moveShape(id, x, y);
    },
    [moveShape]
  );

  const handleShapeTransformEnd = useCallback(
    (id: string, width: number, height: number, x: number, y: number, rotation: number) => {
      resizeShape(id, width, height, x, y, rotation);
    },
    [resizeShape]
  );

  const handleShapeDoubleClick = useCallback(
    (id: string) => {
      setEditingShapeId(id);
    },
    [setEditingShapeId]
  );

  // ─── Cluster interaction handlers ────────────────────────────────
  const handleClusterSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.shiftKey) {
        const store = useBoardStore.getState();
        store.toggleSelection(id);
      } else {
        setSelectedIds([id]);
      }
      bringClusterToFront(id);
    },
    [setSelectedIds, bringClusterToFront]
  );

  const handleClusterDragStart = useCallback(
    (id: string) => {
      const store = useBoardStore.getState();
      store.pushHistory();
      bringClusterToFront(id);
    },
    [bringClusterToFront]
  );

  const handleClusterDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      moveCluster(id, x, y);
    },
    [moveCluster]
  );

  const handleClusterTransformEnd = useCallback(
    (id: string, width: number, height: number, x: number, y: number) => {
      resizeCluster(id, width, height, x, y);
    },
    [resizeCluster]
  );

  const handleClusterDoubleClick = useCallback(
    (id: string) => {
      setEditingClusterId(id);
    },
    [setEditingClusterId]
  );

  // ─── Compute dot grid ────────────────────────────────────────────
  const renderDotGrid = useCallback(() => {
    const { x: vx, y: vy, scale } = viewport;
    const dots: React.ReactElement[] = [];

    if (scale < 0.2) return null;

    const adjustedSpacing = DOT_SPACING;
    const startX = Math.floor((-vx / scale) / adjustedSpacing) * adjustedSpacing;
    const startY = Math.floor((-vy / scale) / adjustedSpacing) * adjustedSpacing;
    const endX = startX + (stageSize.width / scale) + adjustedSpacing;
    const endY = startY + (stageSize.height / scale) + adjustedSpacing;

    const maxDots = 2000;
    let count = 0;
    for (let x = startX; x < endX && count < maxDots; x += adjustedSpacing) {
      for (let y = startY; y < endY && count < maxDots; y += adjustedSpacing) {
        dots.push(
          <Circle
            key={`dot-${x}-${y}`}
            x={x}
            y={y}
            radius={DOT_RADIUS / scale}
            fill={DOT_COLOR}
            name="dot"
            listening={false}
          />
        );
        count++;
      }
    }
    return dots;
  }, [viewport, stageSize]);

  // Sort cards and shapes by zIndex
  const sortedCards = [...cards].sort((a, b) => a.zIndex - b.zIndex);
  const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);
  const sortedImages = [...images].sort((a, b) => a.zIndex - b.zIndex);

  // Connector source item (could be Card or Shape)
  const connectingSourceItem = connectingFromId
    ? cards.find(c => c.id === connectingFromId) || shapes.find(s => s.id === connectingFromId)
    : null;

  // Cursor style
  let cursor = 'default';
  if (activeTool === 'hand' || isPanning.current) cursor = 'grab';
  if (activeTool === 'card') cursor = 'crosshair';
  if (activeTool === 'shape') cursor = 'crosshair';
  if (activeTool === 'connector') cursor = 'crosshair';
  if (activeTool === 'cluster') cursor = 'crosshair';
  if (activeTool === 'text' || activeTool === 'vote') cursor = 'crosshair';

  // Drag-to-draw shape ghost calculation
  let ghostBox: { x: number; y: number; width: number; height: number } | null = null;
  if (drawingShapeStart && drawingShapeCurrent) {
    const x = Math.min(drawingShapeStart.x, drawingShapeCurrent.x);
    const y = Math.min(drawingShapeStart.y, drawingShapeCurrent.y);
    const width = Math.max(1, Math.abs(drawingShapeCurrent.x - drawingShapeStart.x));
    const height = Math.max(1, Math.abs(drawingShapeCurrent.y - drawingShapeStart.y));
    ghostBox = { x, y, width, height };
  }

  // Drag-to-draw cluster ghost calculation
  let ghostClusterBox: { x: number; y: number; width: number; height: number } | null = null;
  if (drawingClusterStart && drawingClusterCurrent) {
    const x = Math.min(drawingClusterStart.x, drawingClusterCurrent.x);
    const y = Math.min(drawingClusterStart.y, drawingClusterCurrent.y);
    const width = Math.max(1, Math.abs(drawingClusterCurrent.x - drawingClusterStart.x));
    const height = Math.max(1, Math.abs(drawingClusterCurrent.y - drawingClusterStart.y));
    ghostClusterBox = { x, y, width, height };
  }

  // Marquee box calculation
  let marqueeBox: { x: number; y: number; width: number; height: number } | null = null;
  if (marqueeStart && marqueeCurrent) {
    const x = Math.min(marqueeStart.x, marqueeCurrent.x);
    const y = Math.min(marqueeStart.y, marqueeCurrent.y);
    const width = Math.max(1, Math.abs(marqueeCurrent.x - marqueeStart.x));
    const height = Math.max(1, Math.abs(marqueeCurrent.y - marqueeStart.y));
    marqueeBox = { x, y, width, height };
  }

  return (
    <Stage
      ref={stageRef}
      width={stageSize.width}
      height={stageSize.height}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      x={viewport.x}
      y={viewport.y}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDblClick={handleStageDblClick}
      onDblTap={handleStageDblClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor, touchAction: 'none' }}
    >
      {/* Background layer */}
      <Layer>
        <Rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="transparent"
          name="background"
        />
        {renderDotGrid()}
      </Layer>

      {/* Clusters layer */}
      <Layer>
        {clusters.map(cluster => (
          <ClusterLabel
            key={cluster.id}
            cluster={cluster}
            isSelected={selectedIds.includes(cluster.id)}
            onSelect={handleClusterSelect}
            onDragStart={handleClusterDragStart}
            onDragEnd={handleClusterDragEnd}
            onTransformEnd={handleClusterTransformEnd}
            onDoubleClick={handleClusterDoubleClick}
          />
        ))}

        {/* Live Drag-to-Draw Cluster Ghost Preview */}
        {ghostClusterBox && (
          <Group x={ghostClusterBox.x} y={ghostClusterBox.y}>
            <Rect
              width={ghostClusterBox.width}
              height={ghostClusterBox.height}
              stroke="#c0392b"
              strokeWidth={1.8}
              dash={[6, 4]}
              fill="rgba(192, 57, 43, 0.07)"
              cornerRadius={8}
              listening={false}
            />
            <Group x={12} y={-14}>
              <Rect
                width={84}
                height={26}
                fill="#241d18"
                cornerRadius={4}
                listening={false}
              />
              <Text
                x={12}
                y={7}
                text="NEW GROUP"
                fontFamily="'Inter', sans-serif"
                fontSize={10}
                fontStyle="bold"
                letterSpacing={1.2}
                fill="#f4ecd8"
                listening={false}
              />
            </Group>
          </Group>
        )}
      </Layer>

      {/* Shapes layer */}
      <Layer>
        {sortedShapes.map(shape => (
          <ShapeNode
            key={shape.id}
            shape={shape}
            isSelected={selectedIds.includes(shape.id)}
            isEditing={editingShapeId === shape.id}
            isConnecting={activeTool === 'connector'}
            isConnectingSource={connectingFromId === shape.id}
            onSelect={handleShapeSelect}
            onDragStart={handleShapeDragStart}
            onDragEnd={handleShapeDragEnd}
            onTransformEnd={handleShapeTransformEnd}
            onDoubleClick={handleShapeDoubleClick}
          />
        ))}

        {/* Live Drag-to-Draw Ghost Preview */}
        {ghostBox && (
          <Rect
            x={ghostBox.x}
            y={ghostBox.y}
            width={ghostBox.width}
            height={ghostBox.height}
            stroke="#c0392b"
            strokeWidth={1.5}
            dash={[6, 3]}
            fill="rgba(192, 57, 43, 0.08)"
            cornerRadius={activeShapeType === 'rectangle' ? 4 : undefined}
            listening={false}
          />
        )}
      </Layer>

      {/* Cards layer */}
      <Layer>
        {sortedCards.map(card => (
          <StickyCard
            key={card.id}
            card={card}
            isSelected={selectedIds.includes(card.id)}
            isEditing={editingCardId === card.id}
            isConnecting={activeTool === 'connector'}
            isConnectingSource={connectingFromId === card.id}
            onSelect={handleCardSelect}
            onDragStart={handleCardDragStart}
            onDragEnd={handleCardDragEnd}
            onDoubleClick={handleCardDoubleClick}
          />
        ))}
        {textItems.map(item => (
          <TextNode key={item.id} item={item} isSelected={selectedIds.includes(item.id)} onSelect={handleTextSelect} onEdit={handleTextEdit} onMove={moveTextItem} />
        ))}
        {voteDots.map(dot => (
          <VoteDotNode key={dot.id} dot={dot} count={voteDots.filter(d => d.x === dot.x && d.y === dot.y && d.color === dot.color).length} isSelected={selectedIds.includes(dot.id)} onSelect={handleVoteSelect} onMove={moveVoteDot} />
        ))}

        {/* Live Marquee Rubber-Band Selection Box */}
        {marqueeBox && (
          <Rect
            x={marqueeBox.x}
            y={marqueeBox.y}
            width={marqueeBox.width}
            height={marqueeBox.height}
            stroke="#a3312b"
            strokeWidth={1.5}
            dash={[6, 3]}
            fill="rgba(163, 49, 43, 0.08)"
            cornerRadius={2}
            listening={false}
          />
        )}
      </Layer>

      {/* Images render above cards/content so selecting one brings it visibly forward. */}
      <Layer>
        {sortedImages.map(image => (
          <ImageNode
            key={image.id}
            image={image}
            isSelected={selectedIds.includes(image.id)}
            onSelect={handleImageSelect}
            onDragStart={handleImageDragStart}
            onDragEnd={moveImage}
            onTransformEnd={handleImageTransformEnd}
          />
        ))}
      </Layer>

      {/* Connectors layer (Yarn strings & mid-point annotation tags rendered on top) */}
      <Layer>
        {connectors.map(conn => {
          const fromItem = cards.find(c => c.id === conn.fromCardId) || shapes.find(s => s.id === conn.fromCardId);
          const toItem = cards.find(c => c.id === conn.toCardId) || shapes.find(s => s.id === conn.toCardId);
          if (!fromItem || !toItem) return null;
          return (
            <ConnectorLine
              key={conn.id}
              connector={conn}
              fromItem={fromItem}
              toItem={toItem}
              isSelected={selectedIds.includes(conn.id)}
              onSelect={(id) => setSelectedIds([id])}
            />
          );
        })}
        {connectingSourceItem && (
          <ConnectorCreator
            fromItem={connectingSourceItem}
            stageRef={stageRef}
            viewport={viewport}
          />
        )}
      </Layer>
    </Stage>
  );
};
