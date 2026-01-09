import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, X } from 'lucide-react';
import { ProjectBar } from './ProjectBar';
import { Button } from '@/presentation/components/shadcn/button';
import { Input } from '@/presentation/components/shadcn/input';
import { useProjectContext } from '@/presentation/contexts/ProjectContext';
import { Project } from '@/shared/types/core';
import type { DragState } from '@/presentation/services/DragPositioning';

interface TimelineCardProps {
  groups: Array<{ id: string; name: string }>;
  groupLayouts: Array<{ visualRows: Array<{ projects: Project[] }> }>;
  collapsedGroups: Set<string>;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  isDragging: boolean;
  dragState: DragState | null;
  handleMilestoneDrag: (milestoneId: string, newDate: Date) => void;
  handleMilestoneDragEnd: () => void;
  handleProjectResizeMouseDown?: (e: React.MouseEvent, projectId: string, action: 'resize-start-date' | 'resize-end-date') => void;
  handlePhaseResizeMouseDown?: (e: React.MouseEvent, projectId: string, phaseId: string, action: 'resize-phase-start' | 'resize-phase-end') => void;
  mode: 'days' | 'weeks';
  collapsed: boolean;
  onToggleGroupCollapse: (groupId: string) => void;
}

/**
 * TimelineCard - Renders the main timeline project grid with groups and auto-layout rows
 */
export function TimelineCard({
  groups,
  groupLayouts,
  collapsedGroups,
  dates,
  viewportStart,
  viewportEnd,
  isDragging,
  dragState,
  handleMilestoneDrag,
  handleMilestoneDragEnd,
  handleProjectResizeMouseDown,
  handlePhaseResizeMouseDown,
  mode,
  collapsed,
  onToggleGroupCollapse
}: TimelineCardProps) {
  const { addGroup } = useProjectContext();
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupName.trim()) {
      addGroup({ 
        name: groupName.trim()
      });
      setGroupName(''); 
      setIsAddingGroup(false);
    }
  };

  return (
    <div className="relative" style={{ zIndex: 2 }}>
      {groups.map((group, groupIndex) => {
        // Get the calculated layout for this group
        const groupLayout = groupLayouts[groupIndex];
        if (!groupLayout) return null;

        // Check if group is collapsed
        const isGroupCollapsed = collapsedGroups.has(group.id);
        
        return (
          <div key={group.id}>
            {/* Group Header Row - Visual separator with group title and collapse chevron */}
            <div className="h-8 relative flex items-center">
              {/* Group name with collapse chevron */}
              <div className="flex items-center gap-2 px-3">
                <button
                  onClick={() => onToggleGroupCollapse(group.id)}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  {isGroupCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  )}
                </button>
                <span className="text-xs font-medium text-gray-700">{group.name}</span>
              </div>
            </div>

            {/* Visual Rows in this group - Auto-calculated, only render if group is not collapsed */}
            {!isGroupCollapsed && groupLayout.visualRows.map((visualRow, visualRowIndex) => {
              return (
                <div key={`${group.id}-vrow-${visualRowIndex}`} className="h-[54px] border-b border-gray-100 relative pt-[2px] pr-[2px] pb-[2px] pl-0">
                  {/* Container for projects in this visual row - fixed height with absolute positioned children */}
                  <div className="relative h-[50px]">
                    {/* Height enforcer - ensures row maintains 50px height even when empty */}
                    <div className="absolute inset-0 min-h-[50px]" />
                    
                    {/* Render all projects in this visual row - positioned absolutely to overlay */}
                    {visualRow.projects.map((project: Project) => {
                      return (
                        <div key={project.id} className="absolute inset-0 pointer-events-none">
                          <ProjectBar
                            project={project}
                            dates={dates}
                            viewportStart={viewportStart}
                            viewportEnd={viewportEnd}
                            isDragging={isDragging}
                            dragState={dragState}
                            mode={mode}
                            isMultiProjectRow={true}
                            collapsed={collapsed}
                            onMilestoneDrag={handleMilestoneDrag}
                            onMilestoneDragEnd={handleMilestoneDragEnd}
                            onProjectResizeMouseDown={handleProjectResizeMouseDown}
                            onPhaseResizeMouseDown={handlePhaseResizeMouseDown}
                          />
                        </div>
                      );
                    })}
                    
                    {/* NO SmartHoverAddProjectBar - projects are auto-positioned */}
                  </div>
                </div>
              );
            })}

            {/* Show empty row if group has no projects and is not collapsed */}
            {!isGroupCollapsed && groupLayout.visualRows.length === 0 && (
              <div className="h-[52px] border-b border-gray-100 relative pt-[2px] pr-[2px] pb-[2px] pl-0">
                <div className="flex items-center justify-center h-full text-xs text-gray-400">
                  No projects in this group
                </div>
              </div>
            )}

            {/* No Add Row spacer needed - rows are auto-generated */}
          </div>
        );
      })}
      
      {/* Add Group Row */}
      {isAddingGroup ? (
        <form onSubmit={handleSubmit} className="flex items-center h-12 px-4 py-2 border-b border-gray-100 bg-green-50/30">
          <div className="w-6 h-6 mr-2"></div>
          <div className="w-2 h-2 rounded-full mr-3 bg-gray-300"></div>
          <div className="flex-1">
            <Input 
              value={groupName} 
              onChange={(e) => setGroupName(e.target.value)} 
              placeholder="Group name" 
              className="h-6 text-xs" 
              autoFocus 
            />
          </div>
          <div className="flex gap-1 ml-2">
            <Button 
              type="submit" 
              size="sm" 
              className="h-6 px-2 text-xs" 
              disabled={!groupName.trim()}
            >
              Add
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={() => setIsAddingGroup(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center h-12 px-4 py-2">
          <button 
            onClick={() => setIsAddingGroup(true)} 
            className="w-6 h-6 mr-2 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
          <span 
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer" 
            onClick={() => setIsAddingGroup(true)}
          >
            Add group
          </span>
        </div>
      )}
    </div>
  );
}
