import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, Edit3 } from 'lucide-react';
import { Button } from '../../ui/button';

import { useProjectContext } from '../../../contexts/ProjectContext';

const ItemTypes = { PROJECT: 'project' };

interface DraggableProjectRowProps {
  project: any;
  index: number;
  groupId: string;
}

export function DraggableProjectRow({ project, index, groupId }: DraggableProjectRowProps) {
  const { reorderProjects, deleteProject, setSelectedProjectId } = useProjectContext();
  const ref = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.PROJECT,
    item: { id: project.id, index, groupId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  
  const [, drop] = useDrop({
    accept: ItemTypes.PROJECT,
    hover: (draggedItem: any, monitor) => {
      if (!ref.current) return;
      if (draggedItem.id === project.id) return;
      if (draggedItem.groupId !== groupId) return;

      const dragIndex = draggedItem.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return;

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      reorderProjects(groupId, dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      draggedItem.index = hoverIndex;
    },
  });

  // Combine refs
  drag(drop(ref));

  return (
    <div 
      ref={ref}
      className={`group flex items-center h-[52px] px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="opacity-0 group-hover:opacity-100 cursor-grab mr-2 text-gray-400">
        <GripVertical className="w-4 h-4" />
      </div>
      <div 
        className="w-2 h-2 rounded-full mr-3 flex-shrink-0" 
        style={{ backgroundColor: project.color }} 
      />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedProjectId(project.id)}>
        <div className="text-sm font-medium text-gray-800 truncate hover:text-gray-600 transition-colors">{project.name}</div>
        <div className="text-xs text-gray-500 truncate">{project.client}</div>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-6 h-6 opacity-0 group-hover:opacity-100"
        onClick={() => setSelectedProjectId(project.id)}
      >
        <Edit3 className="w-4 h-4 text-gray-400" />
      </Button>
    </div>
  );
}