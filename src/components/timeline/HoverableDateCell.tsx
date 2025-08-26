import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HoverableDateCellProps {
  date: Date;
  mode: 'days' | 'weeks';
  children: React.ReactNode;
  width: number;
}

export function HoverableDateCell({ date, mode, children, width }: HoverableDateCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setCurrentView, setCurrentDate } = useTimelineContext();

  const handleClick = () => {
    // Navigate to planner week view at the specified date
    setCurrentDate(new Date(date));
    setCurrentView('calendar');
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className="relative cursor-pointer h-full w-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
          >
            <div className={`transition-opacity duration-200 ${isHovered ? 'opacity-30' : 'opacity-100'}`}>
              {children}
            </div>
            
            {/* Minimal hover overlay with just calendar icon */}
            {isHovered && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                  <Calendar size={12} className="text-blue-600" />
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
