import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, Folders } from 'lucide-react';
import { Button } from '../ui/button';
import { DraggableRowComponent } from './DraggableRowComponent'; // New component for rows
import { AddRowComponent } from './AddRowComponent'; // New component for adding rows
import { DraggableGroupRow } from './DraggableGroupRow';
import { AddGroupRow } from './AddGroupRow';

interface TimelineSidebarProps {
  groups: any[];
  rows: any[]; // Add rows prop
  collapsed: boolean;
  onToggleCollapse: () => void;
  dates?: Date[];
}

export const TimelineSidebar = memo(function TimelineSidebar({ 
  groups, 
  rows,
  collapsed, 
  onToggleCollapse,
  dates = []
}: TimelineSidebarProps) {
  return (
    <div 
      className="bg-white border-r border-gray-200 transition-all duration-300 relative"
      style={{ 
        width: collapsed ? '48px' : '280px',
        minWidth: collapsed ? '48px' : '280px',
        maxWidth: collapsed ? '48px' : '280px'
      }}
    >
      {/* Projects Header */}
      <div className={`h-12 border-b border-gray-200 py-2 flex items-center justify-between ${collapsed ? 'px-0' : 'px-4'}`}>
        {collapsed ? (
          <div className="flex items-center justify-center w-full">
            <Folders className="w-4 h-4 text-gray-600" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Folders className="w-4 h-4 text-gray-600" />
            <span>Projects</span>
          </div>
        )}
        
        {/* Collapse Toggle Button - Positioned over right edge */}
        <button
          onClick={onToggleCollapse}
          className="absolute top-3 -right-3 w-6 h-6 bg-white border border-border rounded-md flex items-center justify-center text-[#595956] hover:bg-gray-50 transition-colors duration-200 z-20"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Groups and Rows List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {groups.map((group, groupIndex) => (
            <DraggableGroupRow key={group.id} group={group} index={groupIndex}>
              {/* Rows in this group */}
              {rows
                .filter(row => row.groupId === group.id)
                .sort((a, b) => a.order - b.order)
                .map((row: any, rowIndex: number) => (
                  <DraggableRowComponent
                    key={row.id}
                    row={row}
                    index={rowIndex}
                    groupId={group.id}
                  />
                ))
              }
              <AddRowComponent groupId={group.id} />
            </DraggableGroupRow>
          ))}
          
          {/* Add Group Row */}
          <AddGroupRow />
        </div>
      )}
    </div>
  );
});