import React from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Folders, PanelLeft } from 'lucide-react';
import { TimelineColumnMarkers } from '../TimelineColumnMarkers';
import { TimelineDateHeaders } from '../TimelineDateHeaders';
import { TimelineScrollbar } from '../TimelineScrollbar';
import { HoverableTimelineScrollbar } from '../HoverableTimelineScrollbar';
import { DraggableRowComponent } from '../DraggableRowComponent';
import { AddRowComponent } from '../AddRowComponent';
import { DraggableGroupRow } from '../DraggableGroupRow';
import { AddGroupRow } from '../AddGroupRow';
import { TimelineBar } from '../TimelineBar';
import { SmartHoverAddProjectBar } from '@/components/projects';
import { AddHolidayRow } from '../AddProjectRow';
import { expandHolidayDates } from '@/services';

interface TimelineContentProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  dates: Date[];
  mode: 'days' | 'weeks';
  groups: any[];
  rows: any[];
  projects: any[];
  holidays: any[];
  collapsedGroups: Set<string>;
  dragState: any;
  viewportStart: Date;
  viewportEnd: Date;
  handleMouseDown: (e: React.MouseEvent, projectId: string, action: string) => void;
  handleHolidayMouseDown: (e: React.MouseEvent, holidayId: string, action: string) => void;
  handleCreateProject: (rowId: string, startDate: Date, endDate: Date) => void;
  handleMilestoneDrag: (milestoneId: string, newDate: Date) => void;
  handleMilestoneDragEnd: () => void;
  setViewportStart: (date: Date) => void;
  setCurrentDate: (date: Date) => void;
  VIEWPORT_DAYS: number;
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
  timelineMode: 'days' | 'weeks';
}

export function TimelineContent({
  collapsed,
  setCollapsed,
  dates,
  mode,
  groups,
  rows,
  projects,
  holidays,
  collapsedGroups,
  dragState,
  viewportStart,
  viewportEnd,
  handleMouseDown,
  handleHolidayMouseDown,
  handleCreateProject,
  handleMilestoneDrag,
  handleMilestoneDragEnd,
  setViewportStart,
  setCurrentDate,
  VIEWPORT_DAYS,
  isAnimating,
  setIsAnimating,
  timelineMode
}: TimelineContentProps) {
  return (
    <Card className="flex-1 flex flex-col overflow-hidden relative timeline-card-container">
      {/* Column Markers - covers timeline area only, doesn't scroll */}
      <div className="absolute pointer-events-none z-1" style={{
        top: '48px', // Below date header
        bottom: '52px', // Above holiday row
        left: collapsed ? '48px' : '280px', // After sidebar
        right: 0,
        transition: 'left 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'left'
      }}>
        <TimelineColumnMarkers dates={dates} mode={mode} />
        {/* Full-column holiday overlays that span the full scroll window */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
          {holidays && holidays.length > 0 && holidays.map(holiday => {
            const expandedDates = expandHolidayDates([{ ...holiday, name: holiday.title || 'Holiday' }]);
            const columnWidth = mode === 'weeks' ? 77 : 40;
            const dayWidth = mode === 'weeks' ? 11 : columnWidth; // 11px per day in weeks mode
            const totalDays = mode === 'weeks' ? dates.length * 7 : dates.length;

            // Calculate day positions for the holiday
            const timelineStart = new Date(dates[0]);
            timelineStart.setHours(0,0,0,0);
            const msPerDay = 24 * 60 * 60 * 1000;

            const startDay = Math.floor((expandedDates[0].getTime() - timelineStart.getTime()) / msPerDay);
            const holidayDays = expandedDates.length;

            const startDayIndex = Math.max(0, startDay);
            const endDayIndex = Math.min(totalDays - 1, startDay + holidayDays - 1);

            if (endDayIndex < 0 || startDayIndex > totalDays - 1) return null;

            const leftPx = startDayIndex * dayWidth;
            const widthPx = (endDayIndex - startDayIndex + 1) * dayWidth;

            // More condensed pattern for weeks view (thinner lines, smaller gaps)
            const backgroundPattern = mode === 'weeks'
              ? 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 1.5px, transparent 1.5px 4px)'
              : 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 2px, transparent 2px 6px)';

            return (
              <div
                key={`holiday-full-${holiday.id}`}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${leftPx}px`,
                  width: `${widthPx}px`,
                  backgroundImage: backgroundPattern
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col min-h-full bg-white">
        {/* Fixed Headers Row */}
        <div className="flex border-b border-gray-200 bg-white relative z-10">
          {/* Sidebar Header */}
          <div
            className="bg-white border-r border-gray-200 flex items-center py-2 relative"
            style={{
              width: collapsed ? '48px' : '280px',
              minWidth: collapsed ? '48px' : '280px',
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'width, min-width',
              zIndex: 25
            }}
          >
            <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'px-4 gap-3'}`}>
              {collapsed ? (
                <Folders className="w-4 h-4 text-gray-600" />
              ) : (
                <>
                  <Folders className="w-4 h-4 text-gray-600" />
                  <span>Projects</span>
                </>
              )}
            </div>

            {/* Collapse Toggle Button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute top-3 -right-3 w-6 h-6 bg-white border border-border rounded-md flex items-center justify-center text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-colors duration-200 z-20"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Date Headers */}
          <div className="flex-1 bg-white" style={{
            minWidth: `${dates.length * (mode === 'weeks' ? 77 : 40)}px`
          }}>
            <TimelineDateHeaders dates={dates} mode={mode} />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto light-scrollbar-vertical-only relative" style={{
          display: 'flex',
          height: '100%'
        }}>
          {/* Sidebar Content */}
          <div
            className="bg-white relative"
            style={{
              width: collapsed ? '48px' : '280px',
              height: '100%',
              transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'width',
              zIndex: 25
            }}
          >
            {/* Border wrapper: at least viewport height, grows with content */}
            <div className="border-r border-gray-200 min-h-full w-full">
              <div style={{
                opacity: collapsed ? 0 : 1,
                visibility: collapsed ? 'hidden' : 'visible',
                transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), visibility 300ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                {groups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Timeline</h3>
                    <p className="text-sm text-gray-500 mb-4 max-w-xs">
                      Start by creating a group to organize your projects, then add rows within the group.
                    </p>
                    <div className="text-xs text-gray-400">
                      Click "Add group" below to get started
                    </div>
                  </div>
                ) : (
                  groups.map((group, groupIndex) => (
                    <DraggableGroupRow key={group.id} group={group} index={groupIndex}>
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
                  ))
                )}
                <AddGroupRow />
              </div>
            </div>
          </div>

          {/* Timeline Content */}
          <div className="bg-white timeline-content-area relative" style={{
            flex: 1,
            height: '100%'
          }}>
            {/* Scrollable Content Layer */}
            <div className="relative z-10">
              {/* Project Timeline Bars - Organized by Groups and Rows */}
              <div className="relative">
                {groups.map(group => {
                  // Get all valid rows for this group
                  const groupRows = rows.filter(row => row.groupId === group.id).sort((a, b) => a.order - b.order);

                  // Get all projects for this group that have valid rowIds
                  const groupProjects = projects.filter(project => project.groupId === group.id);
                  const orphanedProjects = groupProjects.filter(project =>
                    !project.rowId || !rows.some(row => row.id === project.rowId)
                  );

                  // Log warning for orphaned projects in development only
                  if (process.env.NODE_ENV === 'development' && orphanedProjects.length > 0) {
                    console.warn(`Found ${orphanedProjects.length} orphaned projects in group ${group.id}:`, orphanedProjects.map(p => ({ id: p.id, name: p.name, rowId: p.rowId })));
                  }

                  // Check if group is collapsed
                  const isGroupCollapsed = collapsedGroups.has(group.id);

                  return (
                    <div key={group.id}>
                      {/* Group Header Row - Visual separator with optional group title when collapsed */}
                      <div className="h-8 border-b border-gray-200 bg-gray-50/50 relative">
                        {collapsed && (
                          <div
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 z-30 bg-gray-50/90 px-2 py-1 rounded text-xs font-medium text-gray-700"
                            style={{
                              marginLeft: '8px' // 8px gap from sidebar edge
                            }}
                          >
                            {group.name}
                          </div>
                        )}
                      </div>

                      {/* Rows in this group - only render if group is not collapsed */}
                      {!isGroupCollapsed && groupRows.map((row: any) => {
                        // STRICT FILTERING: Only include projects that match BOTH rowId AND groupId
                        const rowProjects = projects.filter(project =>
                          project.rowId === row.id &&
                          project.groupId === group.id &&
                          project.groupId === row.groupId // Triple check: project group matches row group
                        );

                        // SAFETY CHECK: Warn about any projects that have mismatched group/row assignments
                        projects.forEach(project => {
                          if (project.rowId === row.id && project.groupId !== row.groupId) {
                            console.error(`🚨 MISMATCH: Project "${project.name}" (${project.id}) has rowId "${project.rowId}" in row group "${row.groupId}" but project groupId is "${project.groupId}"`);
                          }
                        });

                        return (
                          <div key={row.id} className="h-[52px] border-b border-gray-100 relative">
                            {/* Container for projects in this row - fixed height with absolute positioned children */}
                            <div className="relative h-[52px]">
                              {/* Height enforcer - ensures row maintains 52px height even when empty */}
                              <div className="absolute inset-0 min-h-[52px]" />

                              {/* Render all projects in this row - positioned absolutely to overlay */}
                              {rowProjects.map((project: any) => {
                                // Always render TimelineBar to maintain consistent positioning
                                // TimelineBar will handle visibility internally
                                return (
                                  <div key={project.id} className="absolute inset-0 pointer-events-none">
                                    <TimelineBar
                                      project={project}
                                      dates={dates}
                                      viewportStart={viewportStart}
                                      viewportEnd={viewportEnd}
                                      isDragging={!!dragState}
                                      dragState={dragState}
                                      handleMouseDown={handleMouseDown}
                                      mode={mode}
                                      isMultiProjectRow={true} // Add flag for multi-project rows
                                      collapsed={collapsed}
                                      onMilestoneDrag={handleMilestoneDrag}
                                      onMilestoneDragEnd={handleMilestoneDragEnd}
                                    />
                                  </div>
                                );
                              })}

                              {/* Smart Hover Add Project Bar - positioned within same container as projects */}
                              <SmartHoverAddProjectBar
                                rowId={row.id}
                                dates={dates}
                                projects={rowProjects}
                                onCreateProject={handleCreateProject}
                                mode={mode}
                                isDragging={!!dragState}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Row spacer - only render if group is not collapsed */}
                      {!isGroupCollapsed && <div className="h-9 border-b border-gray-100" />}
                    </div>
                  );
                })}

                {/* Add Group Row spacer */}
                <div className="h-12 border-b border-gray-100" />
              </div>
            </div> {/* End of Scrollable Content Layer */}
          </div>
        </div>

        {/* Fixed Add Holiday Row at bottom */}
        <div className="border-t border-gray-200 bg-yellow-200">
          <AddHolidayRow
            dates={dates}
            collapsed={collapsed}
            isDragging={!!dragState}
            dragState={dragState}
            handleHolidayMouseDown={handleHolidayMouseDown}
            mode={timelineMode}
          />
        </div>
      </div>

      {/* Hoverable Timeline Scrollbar - positioned above holiday row */}
      <HoverableTimelineScrollbar
        viewportStart={viewportStart}
        setViewportStart={setViewportStart}
        setCurrentDate={setCurrentDate}
        VIEWPORT_DAYS={VIEWPORT_DAYS}
        isAnimating={isAnimating}
        setIsAnimating={setIsAnimating}
        sidebarWidth={collapsed ? 48 : 280}
        bottomOffset={54}
        isDragging={!!dragState}
        stopAutoScroll={() => {}} // Auto-scroll handled by services
      />
    </Card>
  );
}
