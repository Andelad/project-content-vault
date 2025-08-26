import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, MoreHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '../ui/dropdown-menu';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useTimelineContext } from '../../contexts/TimelineContext';

const ItemTypes = { GROUP: 'group' };

interface DraggableGroupRowProps {
  group: any;
  index: number;
  children: React.ReactNode;
}

export function DraggableGroupRow({ group, index, children }: DraggableGroupRowProps) {
  const { reorderGroups, deleteGroup } = useProjectContext();
  const { collapsedGroups, toggleGroupCollapse } = useTimelineContext();
  const ref = useRef<HTMLDivElement>(null);
  const isCollapsed = collapsedGroups.has(group.id);
  
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.GROUP,
    item: { id: group.id, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  
  const [, drop] = useDrop({
    accept: ItemTypes.GROUP,
    hover: (draggedItem: any, monitor) => {
      if (!ref.current) return;
      if (draggedItem.id === group.id) return;

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
      reorderGroups(dragIndex, hoverIndex);

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
    <div ref={ref} className={isDragging ? 'opacity-50' : ''}>
      {/* Group Header with Drag Handle */}
      <div 
        className="group h-8 border-b border-gray-200 bg-gray-50/50 flex items-center px-4 hover:bg-gray-100/50 transition-colors"
      >
        <div className="opacity-0 group-hover:opacity-100 cursor-grab mr-2 text-gray-400">
          <GripVertical className="w-3 h-3" />
        </div>
        {/* Chevron for expand/collapse */}
        <button
          onClick={() => toggleGroupCollapse(group.id)}
          className="mr-2 p-0.5 hover:bg-gray-200 rounded transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-gray-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-gray-500" />
          )}
        </button>
        <div 
          className="w-2 h-2 rounded-full mr-3 flex-shrink-0" 
          style={{ backgroundColor: group.color }} 
        />
        <span className="text-sm text-gray-600 flex-1">{group.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-5 h-5 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => deleteGroup(group.id)}
              disabled={group.id === 'work-group' || group.id === 'home-group'}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Group Content - conditionally rendered based on collapse state */}
      {!isCollapsed && children}
    </div>
  );
}