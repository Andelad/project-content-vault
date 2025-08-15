import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import BeachAccess from '@/imports/BeachAccess';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { wouldOverlapHolidays } from '@/lib/workHoursUtils';
import { SmartHoverAddHolidayBar } from './SmartHoverAddHolidayBar';

interface AddProjectRowProps {
  groupId: string;
  dates?: Date[];
}

export function AddProjectRow({ groupId, dates = [] }: AddProjectRowProps) {
  const { setCreatingNewProject } = useApp();

  const handleClick = () => {
    setCreatingNewProject(groupId);
  };

  return (
    <div className="flex items-center h-[52px] px-4 py-3 hover:bg-gray-50/50 transition-colors">
      {/* Space for drag handle to align with projects */}
      <div className="w-4 h-4 mr-2"></div>
      <button 
        onClick={handleClick} 
        className="w-2 h-2 mr-3 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
      <span 
        className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer" 
        onClick={handleClick}
      >
        Add project
      </span>
    </div>
  );
}

interface TimelineAddProjectRowProps {
  groupId: string;
  dates: Date[];
  mode?: 'days' | 'weeks'; // Add mode support
}

export function TimelineAddProjectRow({ groupId, dates, mode = 'days' }: TimelineAddProjectRowProps) {
  const { setCreatingNewProject } = useApp();
  const [hoverBar, setHoverBar] = useState<{ visible: boolean; left: number; dayIndex: number; dayCount: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<{ startX: number; startDayIndex: number; currentDayCount: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get column width based on mode
  const columnWidth = mode === 'weeks' ? 72 : 40;
  const gap = mode === 'weeks' ? 0 : 1; // No gaps in weeks mode
  const defaultSpan = mode === 'weeks' ? 2 : 5; // 2 weeks or 5 days

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || dates.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Helper function to get column position accounting for gaps
    const getColumnLeftPosition = (index: number) => {
      return (index * columnWidth) + (index * gap); // Column width plus gaps
    };
    
    // Find the day index based on x position (accounting for gaps)
    let dayIndex = 0;
    for (let i = 0; i < dates.length; i++) {
      const columnLeft = getColumnLeftPosition(i);
      const columnRight = columnLeft + columnWidth;
      if (x >= columnLeft && x < columnRight) {
        dayIndex = i;
        break;
      } else if (x >= columnRight && i === dates.length - 1) {
        dayIndex = i; // Last column
        break;
      } else if (x < columnLeft) {
        dayIndex = Math.max(0, i - 1);
        break;
      }
    }
    
    if (isDragging && dragState) {
      // Calculate end day based on current mouse position
      const clampedEndDayIndex = Math.max(dragState.startDayIndex, Math.min(dayIndex, dates.length - 1));
      const newDayCount = clampedEndDayIndex - dragState.startDayIndex + 1;
      
      const left = getColumnLeftPosition(dragState.startDayIndex);
      setHoverBar({ 
        visible: true, 
        left, 
        dayIndex: dragState.startDayIndex,
        dayCount: newDayCount
      });

      // Handle timeline scrolling when dragging beyond bounds
      if (e.clientX > rect.right - 50) {
        // Scroll right
        const timelineView = document.querySelector('.timeline-content-area');
        if (timelineView) {
          timelineView.scrollLeft += 10;
        }
      } else if (e.clientX < rect.left + 50) {
        // Scroll left
        const timelineView = document.querySelector('.timeline-content-area');
        if (timelineView) {
          timelineView.scrollLeft -= 10;
        }
      }
    } else {
      // Normal hover behavior
      const clampedDayIndex = Math.max(0, Math.min(dayIndex, dates.length - defaultSpan));
      const left = getColumnLeftPosition(clampedDayIndex);

      setHoverBar({ visible: true, left, dayIndex: clampedDayIndex, dayCount: defaultSpan });
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverBar(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || dates.length === 0 || !hoverBar) return;

    e.preventDefault();
    setIsDragging(true);

    // Helper function to get column position accounting for gaps
    const getColumnLeftPosition = (index: number) => {
      return (index * 40) + (index * 1); // 40px per column + 1px gap per column before this one
    };

    // Add global mouse event listeners
    // Set the start date based on click position, not the hover bar position
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Find the day index based on x position (accounting for gaps)
    let clickedDayIndex = 0;
    for (let i = 0; i < dates.length; i++) {
      const columnLeft = getColumnLeftPosition(i);
      const columnRight = columnLeft + columnWidth;
      if (x >= columnLeft && x < columnRight) {
        clickedDayIndex = i;
        break;
      } else if (x >= columnRight && i === dates.length - 1) {
        clickedDayIndex = i; // Last column
        break;
      } else if (x < columnLeft) {
        clickedDayIndex = Math.max(0, i - 1);
        break;
      }
    }
    
    const clampedStartDayIndex = Math.max(0, Math.min(clickedDayIndex, dates.length - 1));
    
    const currentDragState = {
      startX: e.clientX,
      startDayIndex: clampedStartDayIndex,
      currentDayCount: defaultSpan // Start with default span initially
    };
    
    setDragState(currentDragState);

    // Set initial bar position with default span from click position
    const left = getColumnLeftPosition(clampedStartDayIndex);
    const initialDayCount = Math.min(defaultSpan, dates.length - clampedStartDayIndex);
    setHoverBar({ 
      visible: true, 
      left, 
      dayIndex: clampedStartDayIndex,
      dayCount: initialDayCount
    });
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Find the day index based on x position (accounting for gaps)
      let currentDayIndex = 0;
      for (let i = 0; i < dates.length; i++) {
        const columnLeft = getColumnLeftPosition(i);
        const columnRight = columnLeft + columnWidth;
        if (x >= columnLeft && x < columnRight) {
          currentDayIndex = i;
          break;
        } else if (x >= columnRight && i === dates.length - 1) {
          currentDayIndex = i; // Last column
          break;
        } else if (x < columnLeft) {
          currentDayIndex = Math.max(0, i - 1);
          break;
        }
      }
      
      // Calculate end day based on current mouse position
      const clampedEndDayIndex = Math.max(currentDragState.startDayIndex, Math.min(currentDayIndex, dates.length - 1));
      const newDayCount = clampedEndDayIndex - currentDragState.startDayIndex + 1;
      
      const left = getColumnLeftPosition(currentDragState.startDayIndex);
      setHoverBar({ 
        visible: true, 
        left, 
        dayIndex: currentDragState.startDayIndex,
        dayCount: newDayCount
      });

      // Handle timeline scrolling when dragging beyond bounds (throttled)
      if (e.clientX > rect.right - 50 || e.clientX < rect.left + 50) {
        if (!scrollTimeoutRef.current) {
          scrollTimeoutRef.current = setTimeout(() => {
            const timelineView = document.querySelector('.timeline-content-area');
            if (timelineView) {
              if (e.clientX > rect.right - 50) {
                timelineView.scrollLeft += 10;
              } else if (e.clientX < rect.left + 50) {
                timelineView.scrollLeft -= 10;
              }
            }
            scrollTimeoutRef.current = null;
          }, 50);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (hoverBar && dates.length > 0) {
        // Calculate date range and open modal
        const startDate = new Date(dates[hoverBar.dayIndex]);
        let endDate: Date;
        
        if (mode === 'weeks') {
          // For weeks mode, end date should be the end of the last week
          const endWeekStart = new Date(dates[Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1)]);
          endDate = new Date(endWeekStart);
          endDate.setDate(endWeekStart.getDate() + 6); // End of week
        } else {
          // Days mode - use the actual end date
          const endDateIndex = Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1);
          endDate = new Date(dates[endDateIndex]);
        }
        
        setCreatingNewProject(groupId, { startDate, endDate });
      }

      // Clean up
      setIsDragging(false);
      setDragState(null);
      setHoverBar(null);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return; // Don't handle click if we were dragging

    if (!hoverBar || dates.length === 0) {
      setCreatingNewProject(groupId);
      return;
    }

    // Calculate date range starting from hovered day
    const startDate = new Date(dates[hoverBar.dayIndex]);
    let endDate: Date;
    
    if (mode === 'weeks') {
      // For weeks mode, end date should be the end of the last week
      const endWeekStart = new Date(dates[Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1)]);
      endDate = new Date(endWeekStart);
      endDate.setDate(endWeekStart.getDate() + 6); // End of week
    } else {
      // Days mode - use the actual end date
      const endDateIndex = Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1);
      endDate = new Date(dates[endDateIndex]);
    }

    setCreatingNewProject(groupId, { startDate, endDate });
  };

  const dayWidth = columnWidth; // Column width based on mode
  const barWidth = hoverBar 
    ? (hoverBar.dayCount * columnWidth) + ((hoverBar.dayCount - 1) * gap) 
    : (defaultSpan * columnWidth) + ((defaultSpan - 1) * gap); // Account for gaps

  return (
    <div 
      ref={containerRef}
      className={`h-[52px] border-b border-gray-100 relative transition-colors ${ 
        isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:bg-gray-50/30'
      }`}
      style={{ minWidth: `${dates.length * columnWidth}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Hover/Drag bar */}
      {hoverBar?.visible && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-9 bg-gray-200/80 rounded-md flex items-center justify-center text-gray-600 text-sm pointer-events-none select-none ${
            isDragging ? 'bg-gray-200/90' : 'transition-all duration-75 ease-out'
          }`}
          style={{
            left: `${hoverBar.left}px`,
            width: `${barWidth}px`,
          }}
        >
          Add Project
        </div>
      )}
    </div>
  );
}

interface AddHolidayRowProps {
  dates: Date[];
  collapsed: boolean;
  isDragging?: boolean;
  dragState?: any;
  handleHolidayMouseDown?: (e: React.MouseEvent, holidayId: string, action: string) => void;
  mode?: 'days' | 'weeks';
}

export function AddHolidayRow({ dates, collapsed, isDragging, dragState, handleHolidayMouseDown, mode = 'days' }: AddHolidayRowProps) {
  const { setCreatingNewHoliday, holidays: globalHolidays, setEditingHolidayId, addHoliday } = useApp();
  
  // Convert global holidays to timeline format
  const timelineHolidays = globalHolidays.map(holiday => {
    const startIndex = dates.findIndex(date => {
      const dateStr = date.toDateString();
      const holidayStartStr = holiday.startDate.toDateString();
      return dateStr === holidayStartStr;
    });
    
    if (startIndex === -1) return null;
    
    const endIndex = dates.findIndex(date => {
      const dateStr = date.toDateString();
      const holidayEndStr = holiday.endDate.toDateString();
      return dateStr === holidayEndStr;
    });
    
    const dayCount = endIndex >= startIndex ? endIndex - startIndex + 1 : 1;
    
    return {
      startIndex,
      dayCount,
      id: holiday.id,
      title: holiday.title
    };
  }).filter(Boolean) as { startIndex: number; dayCount: number; id: string; title: string }[];
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle holiday creation after drag
  const handleCreateHoliday = (startDate: Date, endDate: Date) => {
    // Instead of creating the holiday immediately, store the date range for the modal
    setCreatingNewHoliday({ startDate, endDate });
  };

  const dayWidth = dates.length > 0 ? (containerRef.current?.clientWidth || 0) / dates.length : 0;

  return (
    <div className="flex h-[52px] bg-white">
      {/* Sidebar section - must match TimelineSidebar and AvailabilitySidebar widths exactly */}
      <div 
        className="bg-white border-r border-gray-200 transition-all duration-300 flex items-center"
        style={{ 
          width: collapsed ? '48px' : '280px',
          minWidth: collapsed ? '48px' : '280px',
          maxWidth: collapsed ? '48px' : '280px',
          paddingLeft: collapsed ? '0px' : '16px',
          paddingRight: collapsed ? '0px' : '16px',
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}
      >
        {collapsed ? (
          <button 
            onClick={() => setCreatingNewHoliday(null)}
            className="hover:bg-gray-50 transition-colors p-1 rounded -m-1" 
          >
            <div 
              className="w-4 h-4" 
              style={{ '--fill-0': '#6b7280' } as React.CSSProperties}
            >
              <BeachAccess />
            </div>
          </button>
        ) : (
          <button 
            onClick={() => setCreatingNewHoliday(null)}
            className="flex items-center gap-3 hover:bg-gray-50 transition-colors px-2 py-1 rounded-md -mx-2 -my-1"
          >
            <div 
              className="w-4 h-4" 
              style={{ '--fill-0': '#6b7280' } as React.CSSProperties}
            >
              <BeachAccess />
            </div>
            <span className="text-sm font-medium text-gray-800">Add holiday</span>
          </button>
        )}
      </div>

      {/* Timeline section */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex"
      >
        {/* Import and use the new SmartHoverAddHolidayBar */}
        <SmartHoverAddHolidayBar
          dates={dates}
          holidays={globalHolidays}
          mode={mode}
          onCreateHoliday={handleCreateHoliday}
          isDragging={isDragging}
        />

        {/* Holiday display columns */}
        {dates.map((date, dayIndex) => {
          const holiday = timelineHolidays.find(h => 
            dayIndex >= h.startIndex && dayIndex < h.startIndex + h.dayCount
          );
          
          return (
            <HolidayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              date={date}
              holiday={holiday}
              onHolidayClick={(holidayId) => setEditingHolidayId(holidayId)}
              isDragging={isDragging}
              dragState={dragState}
              handleHolidayMouseDown={handleHolidayMouseDown}
              mode={mode}
            />
          );
        })}
      </div>
    </div>
  );
}

interface HolidayColumnProps {
  dayIndex: number;
  date: Date;
  holiday?: { startIndex: number; dayCount: number; id: string; title: string } | null;
  onHolidayClick: (holidayId: string) => void;
  isDragging?: boolean;
  dragState?: any;
  handleHolidayMouseDown?: (e: React.MouseEvent, holidayId: string, action: string) => void;
  mode?: 'days' | 'weeks';
}

function HolidayColumn({ 
  dayIndex, 
  date, 
  holiday, 
  onHolidayClick,
  isDragging,
  dragState,
  handleHolidayMouseDown,
  mode = 'days'
}: HolidayColumnProps) {
  const columnWidth = mode === 'weeks' ? 72 : 40;
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  
  const handleHolidayMouseDownWithClickDetection = (e: React.MouseEvent, holidayId: string, action: string) => {
    console.log('🏖️ Holiday mouse down:', holidayId, action);
    e.stopPropagation(); // Prevent event bubbling
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);
    
    if (handleHolidayMouseDown) {
      handleHolidayMouseDown(e, holidayId, action);
    }
  };

  const handleHolidayMouseUp = (e: React.MouseEvent, holidayId: string) => {
    // Don't stop propagation if we're in a drag operation - let the global handler clean up
    if (!isDragging) {
      e.stopPropagation(); // Only prevent bubbling for click detection, not during drag
    }
    
    const currentTime = Date.now();
    const timeDiff = mouseDownTime ? currentTime - mouseDownTime : 0;
    
    // If it was a quick click (less than 200ms) and didn't move much, treat as a click
    if (timeDiff < 200 && !hasMoved && mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      // If moved less than 5 pixels, consider it a click
      if (moveDist < 5) {
        console.log('🏖️ Holiday click detected:', holidayId);
        onHolidayClick(holidayId);
      }
    }
    
    setMouseDownTime(null);
    setMouseDownPos(null);
    setHasMoved(false);
  };

  const handleHolidayMouseMove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      if (moveDist > 5) {
        setHasMoved(true);
      }
    }
  };
  
  return (
    <div 
      className="relative h-[52px] flex items-center justify-center border-r border-gray-100 last:border-r-0"
      style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}
    >
      {/* Existing holiday display - only show for first day of holiday */}
      {holiday && dayIndex === holiday.startIndex && (
        <div
          className={`absolute top-1/2 left-0 -translate-y-1/2 h-9 bg-orange-200/80 border border-orange-300/50 rounded-md flex items-center justify-center text-orange-800 text-sm transition-all shadow-sm z-20 group ${
            isDragging && dragState?.holidayId === holiday.id 
              ? 'opacity-90 shadow-lg' 
              : 'cursor-move hover:bg-orange-300/80'
          }`}
          style={{
            width: `${holiday.dayCount * columnWidth}px`,
          }}
          onMouseDown={(e) => handleHolidayMouseDownWithClickDetection(e, holiday.id, 'move')}
          onMouseUp={(e) => handleHolidayMouseUp(e, holiday.id)}
          onMouseMove={handleHolidayMouseMove}
          onDoubleClick={(e) => {
            console.log('🏖️ Holiday double-click detected:', holiday.id);
            e.stopPropagation();
            onHolidayClick(holiday.id);
          }}
          title={`Drag to move ${holiday.title}, click/double-click to edit`}
        >
          {/* Holiday title */}
          <span className="truncate px-2 pointer-events-none">
            🏖️ {holiday.title}
          </span>

          {/* Left resize handle */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-black/30 opacity-30 group-hover:opacity-100 transition-opacity rounded-l-md z-50 bg-black/10" 
            onClick={(e) => {
              e.stopPropagation();
              alert('LEFT HANDLE CLICKED - This proves the handle is clickable!');
            }}
            onMouseDown={handleHolidayMouseDown ? (e) => { 
              e.stopPropagation(); 
              console.log('🔥 LEFT RESIZE HANDLE CLICKED!!!');
              handleHolidayMouseDown(e, holiday.id, 'resize-start-date'); 
            } : undefined}
            title="Drag to change start date"
          />
          
          {/* Right resize handle */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-black/30 opacity-30 group-hover:opacity-100 transition-opacity rounded-r-md z-50 bg-black/10" 
            onClick={(e) => {
              e.stopPropagation();
              alert('RIGHT HANDLE CLICKED - This proves the handle is clickable!');
            }}
            onMouseDown={handleHolidayMouseDown ? (e) => { 
              e.stopPropagation(); 
              console.log('🔥 RIGHT RESIZE HANDLE CLICKED!!!');
              handleHolidayMouseDown(e, holiday.id, 'resize-end-date'); 
            } : undefined}
            title="Drag to change end date"
          />

          {/* Edit click area */}
          <div 
            className="absolute top-0 bottom-0 cursor-pointer z-25"
            style={{
              left: '16px',
              right: '16px',
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onHolidayClick(holiday.id);
            }}
            title={`Double-click to edit ${holiday.title}`}
          />
        </div>
      )}
    </div>
  );
}