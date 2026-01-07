import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/shadcn/tooltip';
import { addDaysToDate } from '@/services';

interface HoverableDateCellProps {
  date: Date;
  mode: 'days' | 'weeks';
  children: React.ReactNode;
  width: number;
}

export function HoverableDateCell({ date, mode, children, width }: HoverableDateCellProps) {
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const { setCurrentView, setCurrentDate } = useTimelineContext();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'weeks') {
      // Calculate which day within the week is being hovered
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const dayWidth = 22; // 22px effective spacing (21px + 1px gap)
      const dayIndex = Math.floor(x / dayWidth);
      setHoveredDayIndex(dayIndex >= 0 && dayIndex < 7 ? dayIndex : null);
    } else {
      setHoveredDayIndex(0); // In days mode, treat as single day
    }
  };

  const handleMouseLeave = () => {
    setHoveredDayIndex(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    let targetDate = new Date(date);
    if (mode === 'weeks' && hoveredDayIndex !== null) {
      // Navigate to the specific day within the week using shared date helper
      targetDate = addDaysToDate(date, hoveredDayIndex);
    }
    
    setCurrentDate(targetDate);
    setCurrentView('calendar');
  };

  const isHovered = hoveredDayIndex !== null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-pointer h-full w-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <div className={`transition-opacity duration-200 ${isHovered ? 'opacity-30' : 'opacity-100'}`}>
              {children}
            </div>
            
            {/* Minimal hover overlay with calendar icon */}
            {isHovered && (
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={mode === 'weeks' && hoveredDayIndex !== null ? {
                  left: `${hoveredDayIndex * 22}px`,
                  width: '22px'
                } : undefined}
              >
                <div className="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                  <Calendar size={12} style={{ color: 'oklch(0.50 0.127 232)' }} />
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Go to Planner</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
