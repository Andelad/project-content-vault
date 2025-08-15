import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import BeachAccess from '@/imports/BeachAccess';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { wouldOverlapHolidays } from '@/lib/workHoursUtils';

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
}

export function AddHolidayRow({ dates, collapsed, isDragging, dragState, handleHolidayMouseDown }: AddHolidayRowProps) {
  const { setCreatingNewHoliday, holidays: globalHolidays, setEditingHolidayId, holidayCreationState, setHolidayCreationState, addHoliday } = useApp();
  
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
  
  // Simple state for interactions
  const [holidayDrag, setHolidayDrag] = useState<{ 
    holidayId: string; 
    dragType: 'move' | 'resize-left' | 'resize-right';
    originalStart: number;
    originalCount: number;
  } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const getDayIndex = (clientX: number): number => {
    if (!containerRef.current || dates.length === 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const dayWidth = rect.width / dates.length;
    return Math.max(0, Math.min(Math.floor(x / dayWidth), dates.length - 1));
  };

  const isDayOccupied = (dayIndex: number): boolean => {
    return timelineHolidays.some(holiday => {
      const endIndex = holiday.startIndex + holiday.dayCount - 1;
      return dayIndex >= holiday.startIndex && dayIndex <= endIndex;
    });
  };

  const isHolidayDateRange = (dayIndex: number): boolean => {
    if (!holidayCreationState?.startDate) return false;
    
    // Find the start date in the dates array
    const startIndex = dates.findIndex(date => 
      date.toDateString() === holidayCreationState.startDate!.toDateString()
    );
    
    if (startIndex === -1) return false;
    
    if (holidayCreationState.phase === 'start') {
      return dayIndex === startIndex;
    } else {
      // During end selection, only show the start date as selected
      return dayIndex === startIndex;
    }
  };

  const getHolidayAtPosition = (dayIndex: number) => {
    return timelineHolidays.find(holiday => {
      const endIndex = holiday.startIndex + holiday.dayCount - 1;
      return dayIndex >= holiday.startIndex && dayIndex <= endIndex;
    });
  };

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent) => {
    // No hover preview needed anymore - handled by individual column components
  };

  const handleMouseLeave = () => {
    // No hover preview to clear
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Holiday creation is now handled by individual column components
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    // No longer needed
  };

  const handleGlobalMouseUp = () => {
    // No longer needed
  };

  // Check if a date range would overlap with existing holidays
  const wouldOverlapHoliday = (startIndex: number, endIndex: number): boolean => {
    for (let i = startIndex; i <= endIndex; i++) {
      if (isDayOccupied(i)) {
        return true;
      }
    }
    return false;
  };

  // Handle holiday creation
  const handleHolidayColumnClick = (dayIndex: number) => {
    const date = dates[dayIndex];
    
    if (isDayOccupied(dayIndex)) {
      // Day is occupied by existing holiday - cancel creation if in progress
      if (holidayCreationState) {
        setHolidayCreationState(null);
      }
      return;
    }

    if (!holidayCreationState) {
      // Start creating holiday - set start date
      setHolidayCreationState({
        startDate: date,
        phase: 'end'
      });
    } else if (holidayCreationState.phase === 'end') {
      // Complete holiday creation - set end date
      const startDate = holidayCreationState.startDate!;
      const endDate = date;
      
      // Ensure end date is not before start date
      if (endDate >= startDate) {
        // Check if range would overlap with any existing holidays
        const startIndex = dates.findIndex(d => d.toDateString() === startDate.toDateString());
        const endIndex = dates.findIndex(d => d.toDateString() === endDate.toDateString());
        
        if (!wouldOverlapHoliday(startIndex, endIndex)) {
          // Create the holiday
          addHoliday({
            title: 'New Holiday',
            startDate,
            endDate,
            notes: ''
          });
          
          // Reset creation state
          setHolidayCreationState(null);
          
          // Open the holiday modal for editing
          setCreatingNewHoliday(true);
        }
      }
    }
  };

  // Add escape key handler to cancel holiday creation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && holidayCreationState) {
        setHolidayCreationState(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [holidayCreationState, setHolidayCreationState]);

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
            onClick={() => setCreatingNewHoliday(true)}
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
            onClick={() => setCreatingNewHoliday(true)}
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
        {/* Holiday Creation Columns */}
        {dates.map((date, dayIndex) => {
          const isOccupied = isDayOccupied(dayIndex);
          const holiday = getHolidayAtPosition(dayIndex);
          const isInCreationRange = isHolidayDateRange(dayIndex);
          
          // Check if this date would create an overlap during end date selection
          let wouldOverlap = false;
          if (holidayCreationState?.phase === 'end' && holidayCreationState.startDate && !isOccupied) {
            const startIndex = dates.findIndex(d => d.toDateString() === holidayCreationState.startDate!.toDateString());
            if (startIndex !== -1 && dayIndex >= startIndex) {
              wouldOverlap = wouldOverlapHoliday(startIndex, dayIndex);
            }
          }
          
          // Get tooltip text
          let tooltipText = '';
          let isInvalid = false;
          const formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          
          if (isOccupied) {
            tooltipText = 'Cannot create holiday - overlaps existing holiday';
            isInvalid = true;
          } else if (wouldOverlap) {
            tooltipText = 'Holidays can\'t overlap';
            isInvalid = true;
          } else if (!holidayCreationState) {
            tooltipText = `Set start date\n${formattedDate}`;
          } else if (holidayCreationState.phase === 'end') {
            tooltipText = `Set end date\n${formattedDate}`;
          }
          
          return (
            <HolidayColumn
              key={dayIndex}
              dayIndex={dayIndex}
              date={date}
              isOccupied={isOccupied}
              holiday={holiday}
              isInCreationRange={isInCreationRange}
              isInvalid={isInvalid}
              tooltipText={tooltipText}
              onClick={() => handleHolidayColumnClick(dayIndex)}
              onHolidayClick={(holidayId) => setEditingHolidayId(holidayId)}
              isDragging={isDragging}
              dragState={dragState}
              handleHolidayMouseDown={handleHolidayMouseDown}
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
  isOccupied: boolean;
  holiday?: { startIndex: number; dayCount: number; id: string; title: string } | null;
  isInCreationRange: boolean;
  isInvalid: boolean;
  tooltipText: string;
  onClick: () => void;
  onHolidayClick: (holidayId: string) => void;
  isDragging?: boolean;
  dragState?: any;
  handleHolidayMouseDown?: (e: React.MouseEvent, holidayId: string, action: string) => void;
}

function HolidayColumn({ 
  dayIndex, 
  date, 
  isOccupied, 
  holiday, 
  isInCreationRange, 
  isInvalid,
  tooltipText, 
  onClick, 
  onHolidayClick,
  isDragging,
  dragState,
  handleHolidayMouseDown
}: HolidayColumnProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { holidayCreationState } = useApp();
  
  return (
    <div 
      className="relative h-[52px] flex items-center justify-center border-r border-gray-100 last:border-r-0"
      style={{ minWidth: '40px', width: '40px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Existing holiday display - only show for first day of holiday */}
      {holiday && isOccupied && dayIndex === holiday.startIndex && (
        <div
          className={`absolute top-1/2 left-0 -translate-y-1/2 h-9 bg-orange-200/80 border border-orange-300/50 rounded-md flex items-center justify-center text-orange-800 text-sm transition-all shadow-sm z-10 group ${
            isDragging && dragState?.holidayId === holiday.id 
              ? 'opacity-90 shadow-lg scale-105' 
              : 'cursor-move hover:bg-orange-300/80'
          }`}
          style={{
            width: `${holiday.dayCount * 40}px`, // No gaps needed - holidays span continuously
          }}
          onMouseDown={handleHolidayMouseDown ? (e) => {
            e.stopPropagation(); 
            handleHolidayMouseDown(e, holiday.id, 'move'); 
          } : undefined}
          title={`Drag to move ${holiday.title}`}
        >
          {/* Holiday title */}
          <span className="truncate px-2 pointer-events-none">
            🏖️ {holiday.title}
          </span>

          {/* Left resize handle - high z-index to be above click area */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md z-30" 
            onMouseDown={handleHolidayMouseDown ? (e) => { 
              e.stopPropagation(); 
              handleHolidayMouseDown(e, holiday.id, 'resize-start-date'); 
            } : undefined}
            title="Drag to change start date"
          />
          
          {/* Right resize handle - high z-index to be above click area */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md z-30" 
            onMouseDown={handleHolidayMouseDown ? (e) => { 
              e.stopPropagation(); 
              handleHolidayMouseDown(e, holiday.id, 'resize-end-date'); 
            } : undefined}
            title="Drag to change end date"
          />

          {/* Edit click area - lower z-index, exclude resize handle areas */}
          <div 
            className="absolute top-0 bottom-0 cursor-pointer z-20"
            style={{
              left: '12px', // Start after left resize handle (3px + some margin)
              right: '12px', // End before right resize handle (3px + some margin)
            }}
            onClick={(e) => {
              e.stopPropagation();
              onHolidayClick(holiday.id);
            }}
            title={`Click to edit ${holiday.title}`}
          />
        </div>
      )}
      
      {/* Umbrella symbol for empty columns - don't show during holiday drag operations */}
      {!isOccupied && (isHovered || isInCreationRange) && !holiday && !(isDragging && dragState?.holidayId) && (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`w-6 h-6 z-20 ${
                isInvalid 
                  ? 'text-red-500 hover:text-red-600 hover:bg-red-50' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              onClick={isInvalid ? undefined : onClick}
            >
              <div 
                className="w-4 h-4"
                style={{ '--fill-0': 'currentColor' } as React.CSSProperties}
              >
                <BeachAccess />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            sideOffset={5}
            className={isInvalid ? 'bg-red-600 text-white border-red-600' : ''}
          >
            <div className={isInvalid ? 'text-white' : ''}>
              {tooltipText}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}