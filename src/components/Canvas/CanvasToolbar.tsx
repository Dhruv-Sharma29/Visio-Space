import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import type { Tool, ShapeType, ToolbarDock } from '../../types/board';
import {
  IconCursor, IconStickyNote, IconLink, IconGroup, IconHand,
  IconZoomIn, IconZoomOut, IconZoomFit,
  IconUndo, IconRedo,
  IconExport, IconImport,
  IconTemplate,
  IconSoundOn, IconSoundOff,
  IconText, IconVoteDot,
  IconImage, IconComment,
} from '../Icons/Icons';
import { getAllShapeDefinitions, getShapeDefinition } from '../Shape/shapeRegistry';
import './CanvasToolbar.css';

interface ToolConfig {
  id: Tool;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

interface CanvasToolbarProps {
  onOpenExport: () => void;
  onOpenTemplates: () => void;
  onOpenImport: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({ onOpenExport, onOpenTemplates, onOpenImport }) => {
  const {
    activeTool, setActiveTool,
    activeShapeType, setActiveShapeType,
    zoomIn, zoomOut, zoomToFit, resetView,
    viewport,
    undo, redo,
    history, historyIndex,
    cards, shapes, textItems, voteDots, images,
    selectedIds,
    groupSelected,
    soundEnabled, toggleSound,
    toolbarDock, toolbarOffset, setToolbarPosition,
    addImage, setSelectedIds,
  } = useBoardStore();

  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // A saved percentage can become invalid after a resize or when a tall
  // toolbar is restored on a short screen. Clamp its center using the actual
  // rendered size so the toolbar always remains reachable.
  const clampToolbarPosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const isVertical = toolbarDock === 'left' || toolbarDock === 'right';
    const viewportSize = isVertical ? window.innerHeight : window.innerWidth;
    const toolbarSize = isVertical ? toolbar.offsetHeight : toolbar.offsetWidth;
    const desiredCenter = viewportSize * toolbarOffset / 100;
    const minimumCenter = toolbarSize / 2 + 12;
    const maximumCenter = viewportSize - toolbarSize / 2 - 12;
    const center = minimumCenter > maximumCenter
      ? viewportSize / 2
      : Math.max(minimumCenter, Math.min(maximumCenter, desiredCenter));
    const safeOffset = Math.max(10, Math.min(90, center / viewportSize * 100));
    if (Math.abs(safeOffset - toolbarOffset) > 0.5) setToolbarPosition(toolbarDock, safeOffset);
  }, [setToolbarPosition, toolbarDock, toolbarOffset]);

  useEffect(() => {
    clampToolbarPosition();
    window.addEventListener('resize', clampToolbarPosition);
    return () => window.removeEventListener('resize', clampToolbarPosition);
  }, [clampToolbarPosition]);

  useEffect(() => () => dragCleanup.current?.(), []);

  const handleDockDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const getPosition = (clientX: number, clientY: number): { dock: ToolbarDock; offset: number } => {
      const distances: Array<[ToolbarDock, number]> = [
        ['left', clientX], ['right', window.innerWidth - clientX], ['top', clientY], ['bottom', window.innerHeight - clientY],
      ];
      const dock = distances.reduce((closest, current) => current[1] < closest[1] ? current : closest)[0];
      const axis = dock === 'left' || dock === 'right' ? clientY / window.innerHeight : clientX / window.innerWidth;
      return { dock, offset: Math.max(10, Math.min(90, axis * 100)) };
    };
    const move = (moveEvent: PointerEvent) => {
      const position = getPosition(moveEvent.clientX, moveEvent.clientY);
      setToolbarPosition(position.dock, position.offset);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      dragCleanup.current = null;
    };
    dragCleanup.current?.();
    dragCleanup.current = end;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
  };

  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      window.alert('Please choose an image smaller than 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const image = new window.Image();
      image.onload = () => {
        const maxWidth = 360;
        const maxHeight = 260;
        const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
        const width = Math.max(80, Math.round(image.naturalWidth * ratio));
        const height = Math.max(80, Math.round(image.naturalHeight * ratio));
        const x = (window.innerWidth / 2 - viewport.x) / viewport.scale - width / 2;
        const y = (window.innerHeight / 2 - viewport.y) / viewport.scale - height / 2;
        const id = addImage(reader.result as string, file.name, x, y, width, height);
        if (id) setSelectedIds([id]);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const zoomPercent = Math.round(viewport.scale * 100);
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const canEdit = useBoardStore(s => s.canEdit());

  const currentShapeDef = getShapeDefinition(activeShapeType);
  const CurrentShapeIcon = currentShapeDef.icon;
  const allShapes = getAllShapeDefinitions();

  const TOOLS: ToolConfig[] = [
    { id: 'select', icon: <IconCursor />, label: 'Select', shortcut: 'V' },
    { id: 'card', icon: <IconStickyNote />, label: 'Add Card', shortcut: 'N' },
    { id: 'shape', icon: <CurrentShapeIcon />, label: `Shape (${currentShapeDef.label})`, shortcut: 'S' },
    { id: 'connector', icon: <IconLink />, label: 'Connect', shortcut: 'C' },
    { id: 'cluster', icon: <IconGroup />, label: 'Group', shortcut: 'G' },
    { id: 'text', icon: <IconText />, label: 'Text', shortcut: 'T' },
    { id: 'vote', icon: <IconVoteDot />, label: 'Vote dot', shortcut: 'D' },
    { id: 'comment', icon: <IconComment />, label: 'Comment', shortcut: 'M' },
    { id: 'hand', icon: <IconHand />, label: 'Pan', shortcut: 'H' },
  ];

  const handleToolClick = (toolId: Tool) => {
    if (toolId === 'cluster') {
      if (selectedIds.length > 0) {
        groupSelected();
        return;
      }
      setShapeMenuOpen(false);
      setActiveTool(activeTool === 'cluster' ? 'select' : 'cluster');
      return;
    }

    if (toolId === 'shape') {
      if (activeTool === 'shape') {
        setShapeMenuOpen(!shapeMenuOpen);
      } else {
        setActiveTool('shape');
      }
    } else {
      setShapeMenuOpen(false);
      setActiveTool(toolId);
    }
  };

  const handleShapeSelect = (type: ShapeType, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveShapeType(type);
    setActiveTool('shape');
    setShapeMenuOpen(false);
  };

  return (
    <div ref={toolbarRef} className={`canvas-toolbar canvas-toolbar--${toolbarDock}`} style={toolbarDock === 'left' || toolbarDock === 'right' ? { top: `${toolbarOffset}%` } : { left: `${toolbarOffset}%` }}>
      <div className="toolbar-drag-handle" onPointerDown={handleDockDragStart} title="Drag toolbar to another side" aria-label="Drag toolbar to another side">
        <span /><span /><span /><span /><span /><span />
      </div>
      {/* Tools section */}
      <div className="toolbar-section">
        {TOOLS.map((tool) => {
          const isShapeTool = tool.id === 'shape';
          const isEditTool = tool.id !== 'select' && tool.id !== 'hand' && tool.id !== 'comment';
          const isDisabled = isEditTool && !canEdit;

          return (
            <div key={tool.id} className="toolbar-btn-wrapper">
              <button
                className={`toolbar-btn ${activeTool === tool.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleToolClick(tool.id)}
                disabled={isDisabled}
                title={isDisabled ? `${tool.label} (View-only)` : `${tool.label} (${tool.shortcut})`}
              >
                {tool.icon}
                <span className="toolbar-tooltip">
                  {tool.label}
                  <kbd>{tool.shortcut}</kbd>
                </span>
                {isShapeTool && (
                  <span className="toolbar-dropdown-caret">▾</span>
                )}
              </button>

              {/* Shape Tool Submenu Flyout */}
              {isShapeTool && shapeMenuOpen && (
                <div className="toolbar-shape-flyout">
                  <div className="toolbar-flyout-header">Shapes</div>
                  <div className="toolbar-flyout-grid">
                    {allShapes.map((def) => {
                      const Icon = def.icon;
                      return (
                        <button
                          key={def.type}
                          className={`toolbar-flyout-item ${activeShapeType === def.type && activeTool === 'shape' ? 'active' : ''}`}
                          onClick={(e) => handleShapeSelect(def.type, e)}
                          title={def.label}
                        >
                          <Icon size={18} />
                          <span>{def.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="toolbar-divider" />

      {/* Zoom section */}
      <div className="toolbar-section">
        <button className="toolbar-btn" onClick={zoomOut} title="Zoom out">
          <IconZoomOut />
        </button>
        <button
          className="toolbar-btn toolbar-zoom-display"
          onClick={resetView}
          title="Reset zoom"
        >
          <span className="toolbar-zoom-text">{zoomPercent}%</span>
        </button>
        <button className="toolbar-btn" onClick={zoomIn} title="Zoom in">
          <IconZoomIn />
        </button>
        <button className="toolbar-btn" onClick={zoomToFit} title="Zoom to fit (F)">
          <IconZoomFit />
          <span className="toolbar-tooltip">
            Fit All
            <kbd>F</kbd>
          </span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* History section */}
      <div className="toolbar-section">
        <button
          className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          <IconUndo />
        </button>
        <button
          className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          <IconRedo />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* File & Templates section */}
      <div className="toolbar-section">
        <button className="toolbar-btn" onClick={onOpenTemplates} title="Sensemaking Templates">
          <IconTemplate />
          <span className="toolbar-tooltip">
            Templates
          </span>
        </button>
        <button className="toolbar-btn" onClick={onOpenExport} title="Export board (⌘E)">
          <IconExport />
          <span className="toolbar-tooltip">
            Export
            <kbd>⌘E</kbd>
          </span>
        </button>
        <button className="toolbar-btn" onClick={onOpenImport} title="Import JSON, CSV, or Markdown">
          <IconImport />
          <span className="toolbar-tooltip">Import</span>
        </button>
        <button className="toolbar-btn" onClick={() => imageInputRef.current?.click()} title="Insert image">
          <IconImage />
          <span className="toolbar-tooltip">Insert image</span>
        </button>
        <input ref={imageInputRef} className="toolbar-image-input" type="file" accept="image/*" onChange={handleImageFile} />
        <button
          className={`toolbar-btn ${!soundEnabled ? 'dimmed' : ''}`}
          onClick={toggleSound}
          title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
        >
          {soundEnabled ? <IconSoundOn /> : <IconSoundOff />}
          <span className="toolbar-tooltip">
            {soundEnabled ? 'Sound On' : 'Muted'}
          </span>
        </button>
      </div>

      {/* Total item count badge */}
      {(cards.length > 0 || shapes.length > 0 || textItems.length > 0 || voteDots.length > 0 || images.length > 0) && (
        <div className="toolbar-badge" title={`${cards.length} cards, ${shapes.length} shapes, ${textItems.length} text items, ${voteDots.length} vote dots, ${images.length} images`}>
          {cards.length + shapes.length + textItems.length + voteDots.length + images.length}
        </div>
      )}
    </div>
  );
};
