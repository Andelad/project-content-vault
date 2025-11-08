import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import { Project } from '@/types';
import { ItemTypes } from './DraggableGroup';

interface DraggableProjectProps {
  project: Project;
  index: number;
  groupId: string;
  onMoveProject: (groupId: string, fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
}

export function DraggableProject({ 
  project, 
  index, 
  groupId,
  onMoveProject, 
  children 
}: DraggableProjectProps) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.PROJECT,
    item: { type: ItemTypes.PROJECT, id: project.id, index, groupId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemTypes.PROJECT,
    hover: (item: { type: string; id: string; index: number; groupId: string }) => {
      if (!item || item.type !== ItemTypes.PROJECT) return;
      if (item.groupId !== groupId) return; // Only allow reordering within the same group
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      onMoveProject(groupId, dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  return (
    <div ref={(node) => preview(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex items-center gap-2">
        <div ref={drag} className="cursor-move text-gray-400 hover:text-gray-600 p-1">
          <GripVertical className="w-3 h-3" />
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
