import { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { CARD_COLORS, SHAPE_COLORS, CLUSTER_COLORS } from '../../types/board';
import type { CardColor, ShapeColor, ShapeType, ClusterColor } from '../../types/board';
import {
  IconEdit, IconTrash, IconCopy, IconLink, IconUnlink,
  IconPalette, IconShape, IconGroup, IconStickyNote,
} from '../Icons/Icons';
import { getAllShapeDefinitions } from '../Shape/shapeRegistry';
import './ContextMenu.css';

interface MenuPosition {
  x: number;
  y: number;
}

interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
}

export const ContextMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [targetId, setTargetId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShapeTypePicker, setShowShapeTypePicker] = useState(false);

  const {
    cards, shapes, connectors, clusters,
    selectedIds, setSelectedIds,
    setEditingCardId, setEditingShapeId, setEditingClusterId,
    deleteCard, deleteShape, deleteConnector,
    openConfirmDeleteCluster,
    unlinkCard, ungroup, groupSelected, duplicateCluster,
    updateCard, updateShape, updateCluster,
    addCard, addShape, addCardToCluster,
    setActiveTool, setConnectingFromId,
  } = useBoardStore();

  const close = useCallback(() => {
    setIsOpen(false);
    setShowColorPicker(false);
    setShowShapeTypePicker(false);
    setTargetId(null);
  }, []);

  // Listen for custom context menu events from the canvas
  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        e.preventDefault();
        setPosition({ x: detail.clientX, y: detail.clientY });
        setTargetId(detail.targetId);

        const currentSelected = useBoardStore.getState().selectedIds;
        if (!currentSelected.includes(detail.targetId)) {
          setSelectedIds([detail.targetId]);
        }

        setIsOpen(true);
        setShowColorPicker(false);
        setShowShapeTypePicker(false);
      }
    };

    // Also listen for native right-click to close
    const handleNativeContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        close();
      }
    };

    const handleClick = () => close();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // Close immediately on touch-outside (avoids the ~300ms ghost-click delay on mobile)
    const handleTouchOutside = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        close();
      }
    };

    window.addEventListener('canvas-context-menu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('contextmenu', handleNativeContext);
    window.addEventListener('touchstart', handleTouchOutside, { passive: true });

    return () => {
      window.removeEventListener('canvas-context-menu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('contextmenu', handleNativeContext);
      window.removeEventListener('touchstart', handleTouchOutside);
    };

  }, [close, setSelectedIds]);

  if (!isOpen || !targetId) return null;

  const targetCard = cards.find(c => c.id === targetId);
  const targetShape = shapes.find(s => s.id === targetId);
  const targetConnector = connectors.find(c => c.id === targetId);
  const targetCluster = clusters.find(c => c.id === targetId);

  // Build menu items based on target type
  const menuItems: ContextMenuItem[] = [];

  // Multi-selection grouping action
  if (selectedIds.length > 1) {
    menuItems.push({
      label: `Group ${selectedIds.length} Items (⌘G)`,
      icon: <IconGroup size={15} />,
      action: () => { groupSelected(); close(); },
      dividerAfter: true,
    });
  }

  if (targetCluster) {
    menuItems.push(
      {
        label: 'Add Card to Group',
        icon: <IconStickyNote size={15} />,
        action: () => { addCardToCluster(targetId); close(); },
      },
      {
        label: 'Edit Group Label',
        icon: <IconEdit size={15} />,
        action: () => { setEditingClusterId(targetId); close(); },
      },
      {
        label: 'Change Group Color',
        icon: <IconPalette size={15} />,
        action: () => {
          setShowColorPicker(!showColorPicker);
          setShowShapeTypePicker(false);
        },
      },
      {
        label: 'Duplicate Group & Contents',
        icon: <IconCopy size={15} />,
        action: () => { duplicateCluster(targetId); close(); },
        dividerAfter: true,
      },
      {
        label: 'Ungroup (Keep Items)',
        icon: <IconUnlink size={15} />,
        action: () => { ungroup(targetId); close(); },
      },
      {
        label: 'Delete Group…',
        icon: <IconTrash size={15} />,
        action: () => { openConfirmDeleteCluster(targetId); close(); },
        danger: true,
      },
    );
  } else if (targetCard) {
    menuItems.push(
      {
        label: 'Edit',
        icon: <IconEdit size={15} />,
        action: () => { setEditingCardId(targetId); close(); },
      },
      {
        label: 'Change Color',
        icon: <IconPalette size={15} />,
        action: () => setShowColorPicker(!showColorPicker),
      },
      {
        label: 'Duplicate',
        icon: <IconCopy size={15} />,
        action: () => {
          const id = addCard(targetCard.x + 30, targetCard.y + 30, targetCard.color, targetCard.clusterId);
          const store = useBoardStore.getState();
          store.updateCard(id, {
            title: targetCard.title,
            body: targetCard.body,
            eyebrow: targetCard.eyebrow,
          });
          close();
        },
        dividerAfter: true,
      },
      {
        label: 'Connect to…',
        icon: <IconLink size={15} />,
        action: () => {
          setActiveTool('connector');
          setConnectingFromId(targetId);
          close();
        },
      },
    );

    const hasConn = connectors.some(c => c.fromCardId === targetId || c.toCardId === targetId);
    if (hasConn) {
      menuItems.push({
        label: 'Unlink Connections',
        icon: <IconUnlink size={15} />,
        action: () => { unlinkCard(targetId); close(); },
      });
    }

    menuItems.push(
      {
        label: 'Delete',
        icon: <IconTrash size={15} />,
        action: () => { deleteCard(targetId); close(); },
        danger: true,
      },
    );
  } else if (targetShape) {
    menuItems.push(
      {
        label: 'Edit Label',
        icon: <IconEdit size={15} />,
        action: () => { setEditingShapeId(targetId); close(); },
      },
      {
        label: 'Change Shape Type',
        icon: <IconShape size={15} />,
        action: () => {
          setShowShapeTypePicker(!showShapeTypePicker);
          setShowColorPicker(false);
        },
      },
      {
        label: 'Change Color',
        icon: <IconPalette size={15} />,
        action: () => {
          setShowColorPicker(!showColorPicker);
          setShowShapeTypePicker(false);
        },
      },
      {
        label: 'Duplicate',
        icon: <IconCopy size={15} />,
        action: () => {
          const id = addShape(
            targetShape.type,
            targetShape.x + 30,
            targetShape.y + 30,
            targetShape.width,
            targetShape.height,
            targetShape.color,
            targetShape.text
          );
          useBoardStore.getState().setSelectedIds([id]);
          close();
        },
        dividerAfter: true,
      },
      {
        label: 'Connect to…',
        icon: <IconLink size={15} />,
        action: () => {
          setActiveTool('connector');
          setConnectingFromId(targetId);
          close();
        },
      },
    );

    const hasConn = connectors.some(c => c.fromCardId === targetId || c.toCardId === targetId);
    if (hasConn) {
      menuItems.push({
        label: 'Unlink Connections',
        icon: <IconUnlink size={15} />,
        action: () => { unlinkCard(targetId); close(); },
      });
    }

    menuItems.push(
      {
        label: 'Delete',
        icon: <IconTrash size={15} />,
        action: () => { deleteShape(targetId); close(); },
        danger: true,
      },
    );
  } else if (targetConnector) {
    menuItems.push(
      {
        label: targetConnector.label ? 'Edit Label' : 'Add Label',
        icon: <IconEdit size={15} />,
        action: () => {
          const { setEditingConnectorId } = useBoardStore.getState();
          setEditingConnectorId(targetId);
          close();
        },
      },
      {
        label: targetConnector.style === 'solid' ? 'Change to Dashed' : 'Change to Solid',
        icon: <IconLink size={15} />,
        action: () => {
          const { updateConnector } = useBoardStore.getState();
          updateConnector(targetId, {
            style: targetConnector.style === 'solid' ? 'dashed' : 'solid',
          });
          close();
        },
      },
      {
        label: 'Switch Yarn Color',
        icon: <IconPalette size={15} />,
        action: () => {
          const { updateConnector } = useBoardStore.getState();
          const nextColor = targetConnector.color === 'red' ? 'blue' : targetConnector.color === 'blue' ? 'gray' : 'red';
          updateConnector(targetId, { color: nextColor });
          close();
        },
        dividerAfter: true,
      },
      {
        label: 'Delete Connection',
        icon: <IconTrash size={15} />,
        action: () => { deleteConnector(targetId); close(); },
        danger: true,
      },
    );
  }

  // Clamp position to viewport
  const menuW = 220;
  const menuH = menuItems.length * 36 + 16;
  const x = Math.min(position.x, window.innerWidth - menuW - 8);
  const y = Math.min(position.y, window.innerHeight - menuH - 8);

  const handleCardColorChange = (color: CardColor) => {
    if (targetCard) {
      updateCard(targetId, { color });
    }
    close();
  };

  const handleShapeColorChange = (color: ShapeColor) => {
    if (targetShape) {
      updateShape(targetId, { color });
    }
    close();
  };

  const handleClusterColorChange = (color: ClusterColor) => {
    if (targetCluster) {
      updateCluster(targetId, { color });
    }
    close();
  };

  const handleShapeTypeChange = (type: ShapeType) => {
    if (targetShape) {
      updateShape(targetId, { type });
    }
    close();
  };

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, i) => (
        <div key={i}>
          <button
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={item.action}
          >
            <span className="context-menu-icon">{item.icon}</span>
            <span className="context-menu-label">{item.label}</span>
          </button>
          {item.dividerAfter && <div className="context-menu-divider" />}
        </div>
      ))}

      {/* Shape Type Submenu */}
      {showShapeTypePicker && targetShape && (
        <div className="context-menu-colors" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {getAllShapeDefinitions().map((def) => {
            const Icon = def.icon;
            return (
              <button
                key={def.type}
                className={`context-menu-item ${targetShape.type === def.type ? 'active' : ''}`}
                style={{ padding: '6px', justifyContent: 'center' }}
                onClick={() => handleShapeTypeChange(def.type)}
                title={def.label}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      )}

      {/* Color picker submenu for Clusters */}
      {showColorPicker && targetCluster && (
        <div className="context-menu-colors">
          {(Object.keys(CLUSTER_COLORS) as ClusterColor[]).map((c) => (
            <button
              key={c}
              className={`context-menu-color ${targetCluster.color === c ? 'active' : ''}`}
              style={{
                backgroundColor: CLUSTER_COLORS[c].badgeBg,
                borderColor: CLUSTER_COLORS[c].border,
              }}
              onClick={() => handleClusterColorChange(c)}
              title={c}
            />
          ))}
        </div>
      )}

      {/* Color picker submenu for Cards */}
      {showColorPicker && targetCard && (
        <div className="context-menu-colors">
          {(Object.keys(CARD_COLORS) as CardColor[]).map((c) => (
            <button
              key={c}
              className={`context-menu-color ${targetCard.color === c ? 'active' : ''}`}
              style={{ backgroundColor: CARD_COLORS[c].bg, borderColor: CARD_COLORS[c].border }}
              onClick={() => handleCardColorChange(c)}
              title={c}
            />
          ))}
        </div>
      )}

      {/* Color picker submenu for Shapes */}
      {showColorPicker && targetShape && (
        <div className="context-menu-colors">
          {(Object.keys(SHAPE_COLORS) as ShapeColor[]).map((c) => (
            <button
              key={c}
              className={`context-menu-color ${targetShape.color === c ? 'active' : ''}`}
              style={{
                backgroundColor: SHAPE_COLORS[c].bg === 'transparent' ? '#ffffff' : SHAPE_COLORS[c].bg,
                borderColor: SHAPE_COLORS[c].border,
              }}
              onClick={() => handleShapeColorChange(c)}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
};
