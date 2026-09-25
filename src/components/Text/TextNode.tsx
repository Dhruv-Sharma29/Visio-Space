import React, { useRef } from 'react';
import { Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { TextItem } from '../../types/board';

interface Props {
  item: TextItem;
  isSelected?: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onEdit: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

export const TextNode: React.FC<Props> = ({ item, isSelected: _isSelected, onSelect, onEdit, onMove }) => {
  const nodeRef = useRef<Konva.Group>(null);
  return (
    <Group
      ref={nodeRef}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable
      onClick={e => onSelect(item.id, e)}
      onTap={e => onSelect(item.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
      onDblClick={() => onEdit(item.id)}
      onDblTap={() => onEdit(item.id)}
      onDragEnd={e => onMove(item.id, e.target.x(), e.target.y())}
    >
      <Text
        text={item.text || 'Double-click to edit'}
        width={item.width}
        fontSize={item.fontSize}
        fill={item.color}
        fontFamily="Inter, sans-serif"
        padding={4}
        wrap="word"
      />
    </Group>
  );
};
