import React, { useState, useRef, useEffect } from 'react';
import { Plus, Move } from 'lucide-react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { ParasolIcon } from '@/assets';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { wouldOverlapHolidays } from '@/services';
import { SmartHoverAddHolidayBar } from './SmartHoverAddHolidayBar';

interface AddProjectRowProps {
  groupId: string;
  dates?: Date[];
}

export function AddProjectRow({ groupId, dates = [] }: AddProjectRowProps) {
  const { setCreatingNewProject, rows } = useProjectContext();

  // Check if there are any rows in this group
  const groupRows = rows.filter(row => row.groupId === groupId);
  
  const handleClick = () => {
    if (groupRows.length === 0) {
      // Show helpful guidance instead of generic alert
      alert('To add projects, you first need to create a row in this group.\n\nClick the "Add row" button in the sidebar under this group.');
      return;
    }
    
    // Use the first available row in the group
    const firstRowId = groupRows.sort((a, b) => a.order - b.order)[0].id;
    
    setCreatingNewProject(groupId, undefined, firstRowId);
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
  const { setCreatingNewProject, rows } = useProjectContext();
  const [hoverBar, setHoverBar] = useState<{ visible: boolean; left: number; dayIndex: number; dayCount: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<{ startX: number; startDayIndex: number; currentDayCount: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if there are any rows in this group
  const groupRows = rows.filter(row => row.groupId === groupId);

  // Get column width based on mode - match TimelineView's column width
  const columnWidth = mode === 'weeks' ? 77 : 52;
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
    
    let dayIndex = 0;
    
    if (mode === 'weeks') {
      // In weeks mode, calculate precise day-level index within the timeline
      const dayWidth = 11; // Exact 11px per day (77px ÷ 7 days)
      const totalDays = dates.length * 7; // Total number of days across all weeks
      dayIndex = Math.floor(x / dayWidth);
      dayIndex = Math.max(0, Math.min(dayIndex, totalDays - 1));
    } else {
      // Helper function to get column position accounting for gaps (days mode only)
      const getColumnLeftPosition = (index: number) => {
        return (index * columnWidth) + (index * gap); // Column width plus gaps
      };
      
      // Find the day index based on x position (accounting for gaps) - days mode
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
    }
    
    if (isDragging && dragState) {
      // Calculate end day based on current mouse position
      const maxDayIndex = mode === 'weeks' ? (dates.length * 7 - 1) : (dates.length - 1);
      const clampedEndDayIndex = Math.max(dragState.startDayIndex, Math.min(dayIndex, maxDayIndex));
      const newDayCount = clampedEndDayIndex - dragState.startDayIndex + 1;
      
      // Calculate left position based on mode
      let left: number;
      if (mode === 'weeks') {
        left = dragState.startDayIndex * 11; // 11px per day
      } else {
        const getColumnLeftPosition = (index: number) => {
          return (index * columnWidth) + (index * gap);
        };
        left = getColumnLeftPosition(dragState.startDayIndex);
      }
      
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
      const maxDayIndex = mode === 'weeks' ? (dates.length * 7 - 1) : (dates.length - 1);
      const clampedDayIndex = Math.max(0, Math.min(dayIndex, maxDayIndex - defaultSpan + 1));
      
      // Calculate left position based on mode
      let left: number;
      if (mode === 'weeks') {
        left = clampedDayIndex * 11; // 11px per day
      } else {
        const getColumnLeftPosition = (index: number) => {
          return (index * columnWidth) + (index * gap);
        };
        left = getColumnLeftPosition(clampedDayIndex);
      }

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

    // Set the start date based on click position, not the hover bar position
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    let clickedDayIndex = 0;
    
    if (mode === 'weeks') {
      // In weeks mode, calculate precise day-level index
      const dayWidth = 11; // Exact 11px per day (77px ÷ 7 days)
      const totalDays = dates.length * 7;
      clickedDayIndex = Math.floor(x / dayWidth);
      clickedDayIndex = Math.max(0, Math.min(clickedDayIndex, totalDays - 1));
    } else {
      // Helper function for days mode gaps
      const getColumnLeftPosition = (index: number) => {
        return (index * columnWidth) + (index * gap);
      };
      
      // Find the day index based on x position (accounting for gaps) - days mode
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
    }
    
    const maxDayIndex = mode === 'weeks' ? (dates.length * 7 - 1) : (dates.length - 1);
    const clampedStartDayIndex = Math.max(0, Math.min(clickedDayIndex, maxDayIndex));
    
    const currentDragState = {
      startX: e.clientX,
      startDayIndex: clampedStartDayIndex,
      currentDayCount: defaultSpan // Start with default span initially
    };
    
    setDragState(currentDragState);

    // Set initial bar position with default span from click position
    let left: number;
    if (mode === 'weeks') {
      left = clampedStartDayIndex * 11; // 11px per day
    } else {
      const getColumnLeftPosition = (index: number) => {
        return (index * columnWidth) + (index * gap);
      };
      left = getColumnLeftPosition(clampedStartDayIndex);
    }
    
    const maxAvailableDays = maxDayIndex - clampedStartDayIndex + 1;
    const initialDayCount = Math.min(defaultSpan, maxAvailableDays);
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
      
      let currentDayIndex = 0;
      
      if (mode === 'weeks') {
        // In weeks mode, calculate precise day-level index
        const dayWidth = 11; // Exact 11px per day (77px ÷ 7 days)
        const totalDays = dates.length * 7;
        currentDayIndex = Math.floor(x / dayWidth);
        currentDayIndex = Math.max(0, Math.min(currentDayIndex, totalDays - 1));
      } else {
        // Helper function for days mode gaps
        const getColumnLeftPosition = (index: number) => {
          return (index * columnWidth) + (index * gap);
        };
        
        // Find the day index based on x position (accounting for gaps) - days mode
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
      }
      
      // Calculate end day based on current mouse position
      const maxDayIndex = mode === 'weeks' ? (dates.length * 7 - 1) : (dates.length - 1);
      const clampedEndDayIndex = Math.max(currentDragState.startDayIndex, Math.min(currentDayIndex, maxDayIndex));
      const newDayCount = clampedEndDayIndex - currentDragState.startDayIndex + 1;
      
      // Calculate left position based on mode
      let left: number;
      if (mode === 'weeks') {
        left = currentDragState.startDayIndex * 11; // 11px per day
      } else {
        const getColumnLeftPosition = (index: number) => {
          return (index * columnWidth) + (index * gap);
        };
        left = getColumnLeftPosition(currentDragState.startDayIndex);
      }
      
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
        // Check if there are any rows in this group
        if (groupRows.length === 0) {
          alert('To add projects, you first need to create a row in this group.\n\nClick the "Add row" button in the sidebar under this group.');
          return;
        }

        // Use the first available row in the group
        const firstRowId = groupRows.sort((a, b) => a.order - b.order)[0].id;

        // Calculate date range and open modal
        let startDate: Date;
        let endDate: Date;
        
        if (mode === 'weeks') {
          // In weeks mode, dayIndex is now a day-level index across all weeks
          // Calculate which week and day within week
          const weekIndex = Math.floor(hoverBar.dayIndex / 7);
          const dayInWeek = hoverBar.dayIndex % 7;
          
          if (weekIndex < dates.length) {
            const weekStart = new Date(dates[weekIndex]);
            startDate = new Date(weekStart);
            startDate.setDate(weekStart.getDate() + dayInWeek);
            
            // Calculate end date
            const endDayIndex = hoverBar.dayIndex + hoverBar.dayCount - 1;
            const endWeekIndex = Math.floor(endDayIndex / 7);
            const endDayInWeek = endDayIndex % 7;
            
            if (endWeekIndex < dates.length) {
              const endWeekStart = new Date(dates[endWeekIndex]);
              endDate = new Date(endWeekStart);
              endDate.setDate(endWeekStart.getDate() + endDayInWeek);
            } else {
              // Fallback to last available date
              endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + hoverBar.dayCount - 1);
            }
          } else {
            // Fallback
            startDate = new Date(dates[0]);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + hoverBar.dayCount - 1);
          }
        } else {
          // Days mode - use the actual date indices
          startDate = new Date(dates[hoverBar.dayIndex]);
          const endDateIndex = Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1);
          endDate = new Date(dates[endDateIndex]);
        }
        
        setCreatingNewProject(groupId, { startDate, endDate }, firstRowId);
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
      // Check if there are any rows in this group
      if (groupRows.length === 0) {
        alert('To add projects, you first need to create a row in this group.\n\nClick the "Add row" button in the sidebar under this group.');
        return;
      }

      // Use the first available row in the group
      const firstRowId = groupRows.sort((a, b) => a.order - b.order)[0].id;
      setCreatingNewProject(groupId, undefined, firstRowId);
      return;
    }

    // Check if there are any rows in this group
    if (groupRows.length === 0) {
      alert('To add projects, you first need to create a row in this group.\n\nClick the "Add row" button in the sidebar under this group.');
      return;
    }

    // Use the first available row in the group
    const firstRowId = groupRows.sort((a, b) => a.order - b.order)[0].id;

    // Calculate date range starting from hovered day
    let startDate: Date;
    let endDate: Date;
    
    if (mode === 'weeks') {
      // In weeks mode, dayIndex is now a day-level index across all weeks
      const weekIndex = Math.floor(hoverBar.dayIndex / 7);
      const dayInWeek = hoverBar.dayIndex % 7;
      
      if (weekIndex < dates.length) {
        const weekStart = new Date(dates[weekIndex]);
        startDate = new Date(weekStart);
        startDate.setDate(weekStart.getDate() + dayInWeek);
        
        // Calculate end date
        const endDayIndex = hoverBar.dayIndex + hoverBar.dayCount - 1;
        const endWeekIndex = Math.floor(endDayIndex / 7);
        const endDayInWeek = endDayIndex % 7;
        
        if (endWeekIndex < dates.length) {
          const endWeekStart = new Date(dates[endWeekIndex]);
          endDate = new Date(endWeekStart);
          endDate.setDate(endWeekStart.getDate() + endDayInWeek);
        } else {
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + hoverBar.dayCount - 1);
        }
      } else {
        // Fallback
        startDate = new Date(dates[0]);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + hoverBar.dayCount - 1);
      }
    } else {
      // Days mode - use the actual date indices
      startDate = new Date(dates[hoverBar.dayIndex]);
      const endDateIndex = Math.min(hoverBar.dayIndex + hoverBar.dayCount - 1, dates.length - 1);
      endDate = new Date(dates[endDateIndex]);
    }

    setCreatingNewProject(groupId, { startDate, endDate }, firstRowId);
  };

  // Calculate bar width based on mode
  let barWidth: number;
  if (hoverBar) {
    if (mode === 'weeks') {
      // In weeks mode, each day is 11px wide
      barWidth = hoverBar.dayCount * 11;
    } else {
      // Days mode - use column width and gaps
      barWidth = (hoverBar.dayCount * columnWidth) + ((hoverBar.dayCount - 1) * gap);
    }
  } else {
    if (mode === 'weeks') {
      // Default span in weeks mode
      barWidth = defaultSpan * 11;
    } else {
      // Default span in days mode
      barWidth = (defaultSpan * columnWidth) + ((defaultSpan - 1) * gap);
    }
  }

  return (
    <div 
      ref={containerRef}
      className={`h-[52px] border-b border-gray-100 relative transition-colors ${ 
        isDragging ? 'cursor-grabbing' : 'cursor-pointer hover:bg-gray-50/30'
      }`}
      style={{ 
        minWidth: mode === 'weeks' 
          ? `${dates.length * 77}px` 
          : `${dates.length * columnWidth + columnWidth}px` // Add buffer for days mode
      }}
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
  const { holidays: globalHolidays, addHoliday, setCreatingNewHoliday, setEditingHolidayId } = usePlannerContext();
  
  // Convert global holidays to timeline format
  const timelineHolidays = globalHolidays.map(holiday => {
    if (mode === 'weeks') {
      // For weeks mode, we need to calculate which weeks contain the holiday
      // and then calculate the exact day positions within those weeks
      const holidayStart = new Date(holiday.startDate);
      holidayStart.setHours(0, 0, 0, 0);
      const holidayEnd = new Date(holiday.endDate);
      holidayEnd.setHours(0, 0, 0, 0);
      
      // Find which week columns this holiday spans
      let startWeekIndex = -1;
      let endWeekIndex = -1;
      
      dates.forEach((weekStart, weekIndex) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Check if holiday overlaps with this week
        if (!(holidayEnd < weekStart || holidayStart > weekEnd)) {
          if (startWeekIndex === -1) {
            startWeekIndex = weekIndex;
          }
          endWeekIndex = weekIndex;
        }
      });
      
      if (startWeekIndex === -1) return null;
      
      // Calculate the day-level start and end indices
      const firstWeekStart = dates[startWeekIndex];
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Calculate start day index (within the week view timeline)
      const daysFromFirstWeekToHolidayStart = Math.floor((holidayStart.getTime() - firstWeekStart.getTime()) / msPerDay);
      const startDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayStart;
      
      // Calculate end day index
      const daysFromFirstWeekToHolidayEnd = Math.floor((holidayEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
      const endDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayEnd;
      
      // Calculate the day count for display
      const dayCount = endDayIndex - startDayIndex + 1;
      
      return {
        startIndex: startDayIndex,
        dayCount,
        id: holiday.id,
        title: holiday.title,
        weekMode: true, // Flag to indicate this is week mode calculation
        actualStartWeek: startWeekIndex,
        actualEndWeek: endWeekIndex
      };
    } else {
      // Days mode: Calculate position relative to viewport, but maintain full holiday width
      const holidayStart = new Date(holiday.startDate);
      holidayStart.setHours(0, 0, 0, 0);
      const holidayEnd = new Date(holiday.endDate);
      holidayEnd.setHours(23, 59, 59, 999);
      
      if (dates.length === 0) return null;
      
      const firstVisibleDate = dates[0];
      const lastVisibleDate = dates[dates.length - 1];
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Calculate the actual start index relative to the first visible date
      // This can be negative if the holiday starts before the viewport
      const startIndex = Math.floor((holidayStart.getTime() - firstVisibleDate.getTime()) / msPerDay);
      
      // Calculate the full duration of the holiday in days
      const dayCount = Math.floor((holidayEnd.getTime() - holidayStart.getTime()) / msPerDay) + 1;
      
      // Check if holiday is completely outside viewport (optimization)
      const holidayEndIndex = startIndex + dayCount - 1;
      const lastVisibleIndex = dates.length - 1;
      
      if (holidayEndIndex < 0 || startIndex > lastVisibleIndex) {
        // Holiday is completely outside viewport
        return null;
      }
      
      return {
        startIndex,
        dayCount,
        id: holiday.id,
        title: holiday.title,
        weekMode: false
      };
    }
  }).filter(Boolean) as { startIndex: number; dayCount: number; id: string; title: string; weekMode?: boolean; actualStartWeek?: number; actualEndWeek?: number }[];
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle holiday creation after drag
  const handleCreateHoliday = (startDate: Date, endDate: Date) => {
    // Instead of creating the holiday immediately, store the date range for the modal
    setCreatingNewHoliday({ startDate, endDate });
  };

  const dayWidth = dates.length > 0 ? (containerRef.current?.clientWidth || 0) / dates.length : 0;

  return (
    <div className="h-[52px] bg-white relative">
      {/* Timeline section */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex h-full"
      >
        {/* Sticky Add Holiday Icon - matches project indicator style */}
        <div className="absolute left-2 z-30" style={{ top: '15px' }}>
          <button
            onClick={() => {
              const today = new Date();
              const endDate = new Date(today);
              endDate.setDate(today.getDate() + 2); // 2 days from today
              setCreatingNewHoliday({ startDate: today, endDate });
            }}
            className="relative w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg drop-shadow-sm hover:brightness-95 group"
            style={{ backgroundColor: '#D1D5DB' }}
            title="Add holiday"
          >
            {/* Parasol icon - default state */}
            <div className="transition-opacity duration-200 group-hover:opacity-0">
              <ParasolIcon className="w-3 h-3 text-foreground" />
            </div>
            
            {/* Plus icon - hover state */}
            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100">
              <Plus className="w-3 h-3 text-foreground" />
            </div>
          </button>
        </div>
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
          let holiday = null;
          
          if (mode === 'weeks') {
            // In week mode, show the holiday in the week where it should be visually positioned
            // Find holidays that span this week and render them with proper positioning
            holiday = timelineHolidays.find(h => 
              h.weekMode && 
              dayIndex >= h.actualStartWeek && 
              dayIndex <= h.actualEndWeek &&
              dayIndex === h.actualStartWeek // Only render in the first week to avoid duplicates
            );
          } else {
            // Days mode: dayIndex represents actual day index
            // Show holiday in each day it spans
            holiday = timelineHolidays.find(h => 
              dayIndex >= h.startIndex && dayIndex < h.startIndex + h.dayCount
            );
          }
          
          return (
            <HolidayBar
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

interface HolidayBarProps {
  dayIndex: number;
  date: Date;
  holiday?: { startIndex: number; dayCount: number; id: string; title: string } | null;
  onHolidayClick: (holidayId: string) => void;
  isDragging?: boolean;
  dragState?: any;
  handleHolidayMouseDown?: (e: React.MouseEvent, holidayId: string, action: string) => void;
  mode?: 'days' | 'weeks';
}

function HolidayBar({ 
  dayIndex, 
  date, 
  holiday, 
  onHolidayClick,
  isDragging,
  dragState,
  handleHolidayMouseDown,
  mode = 'days'
}: HolidayBarProps) {
  const columnWidth = mode === 'weeks' ? 77 : 52; // Match TimelineView's column width
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  
  const handleHolidayMouseDownWithClickDetection = (e: React.MouseEvent, holidayId: string, action: string) => {
    e.stopPropagation(); // Prevent event bubbling
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);
    
    if (handleHolidayMouseDown) {
      handleHolidayMouseDown(e, holidayId, action);
    }
  };

  const handleHolidayMouseUp = (e: React.MouseEvent, holidayId: string) => {
    const currentTime = Date.now();
    const timeDiff = mouseDownTime ? currentTime - mouseDownTime : 0;
    
    // Quick click detection - if it was fast and didn't move much, treat as click
    if (timeDiff < 200 && !hasMoved && mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      // If moved less than 3 pixels, consider it a click
      if (moveDist < 3) {
        e.stopPropagation();
        onHolidayClick(holidayId);
      }
    }
    
    setMouseDownTime(null);
    setMouseDownPos(null);
    setHasMoved(false);
  };

  const handleHolidayMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      // Mark as moved if moved more than 3 pixels
      if (moveDist > 3) {
        setHasMoved(true);
      }
    }
  };
  
  return (
    <div 
      className="relative h-[52px] flex items-center justify-center border-r border-gray-100 last:border-r-0"
      style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}
    >
      {/* Existing holiday display - show if holiday exists for this column */}
      {holiday && (
        mode === 'weeks' || 
        (mode === 'days' && dayIndex === Math.max(0, holiday.startIndex))
      ) && (
        <div
          className={`absolute top-1/2 left-0 -translate-y-1/2 h-9 bg-orange-200/80 border border-orange-300/50 rounded-md flex items-center justify-center text-orange-800 text-sm transition-all shadow-sm z-[1] group ${
            isDragging && dragState?.holidayId === holiday.id 
              ? 'opacity-90 shadow-lg' 
              : 'hover:bg-orange-300/80'
          }`}
          style={(() => {
            if (mode === 'weeks') {
              // For week mode, calculate the precise positioning within week columns
              const dayWidth = 11; // Exact 11px per day (77px ÷ 7 days)
              
              // Use modulo to get position within the current week
              const holidayStartInCurrentWeek = holiday.startIndex % 7; // Day of week (0-6)
              const leftOffset = holidayStartInCurrentWeek * dayWidth;
              
              // Calculate the width based on how many days the holiday spans
              const width = holiday.dayCount * dayWidth;
              
              return {
                left: `${leftOffset}px`,
                width: `${width}px`,
              };
            } else {
              // Days mode: Handle holidays that extend beyond viewport
              // Calculate how far into the holiday this dayIndex is
              const dayIntoHoliday = dayIndex - holiday.startIndex;
              
              // Calculate left offset - if holiday starts before this day, offset left
              const leftOffset = dayIntoHoliday > 0 ? -dayIntoHoliday * columnWidth : 0;
              
              return {
                left: `${leftOffset}px`,
                width: `${holiday.dayCount * columnWidth}px`,
              };
            }
          })()}
          title={`${holiday.title} - Click to edit, drag sides to resize, drag center to move`}
        >
          {/* Holiday title */}
          <span className="truncate px-2 pointer-events-none select-none">
            🏖️ {holiday.title}
          </span>

          {/* Left resize area - Two-way arrow cursor for resizing */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize pointer-events-auto"
            style={{ zIndex: 3 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              handleHolidayMouseDown(e, holiday.id, 'resize-start-date');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              const touch = e.touches[0];
              const fakeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
              } as any;
              
              handleHolidayMouseDown(fakeMouseEvent, holiday.id, 'resize-start-date');
            }}
            title="Drag to change start date"
          />
          
          {/* Right resize area - Two-way arrow cursor for resizing */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize pointer-events-auto"
            style={{ zIndex: 3 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              handleHolidayMouseDown(e, holiday.id, 'resize-end-date');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              const touch = e.touches[0];
              const fakeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
              } as any;
              
              handleHolidayMouseDown(fakeMouseEvent, holiday.id, 'resize-end-date');
            }}
            title="Drag to change end date"
          />

          {/* Main clickable area - Single click to open modal, four-way cursor for dragging */}
          <div 
            className="absolute inset-0 cursor-move"
            style={{ zIndex: 2 }}
            onMouseDown={(e) => handleHolidayMouseDownWithClickDetection(e, holiday.id, 'move')}
            onMouseUp={(e) => handleHolidayMouseUp(e, holiday.id)}
            onMouseMove={handleHolidayMouseMove}
            onClick={(e) => {
              e.stopPropagation();
              // Single click opens modal - prioritize click over drag state
              if (!hasMoved) {
                onHolidayClick(holiday.id);
              }
            }}
            title="Click to edit holiday, drag to move"
          />
        </div>
      )}
    </div>
  );
}