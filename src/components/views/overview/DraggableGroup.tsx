import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import { Group } from '@/types';

export const ItemTypes = {
  GROUP: 'group',
  PROJECT: 'project'
} as const;

interface DraggableGroupProps {
  group: Group;
  index: number;
  onMoveGroup: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

export function DraggableGroup({ 
  group, 
  index, 
  onMoveGroup, 
  children 
}: DraggableGroupProps) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.GROUP,
    item: { type: ItemTypes.GROUP, id: group.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.GROUP,
    hover: (item: { type: string; id: string; index: number }) => {
      if (!item || item.type !== ItemTypes.GROUP) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      onMoveGroup(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  return (
    <div ref={(node) => preview(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex items-start gap-3">
        <div ref={drag} className="cursor-move pt-6 text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
