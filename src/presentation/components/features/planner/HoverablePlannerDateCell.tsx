import React, { useState } from 'react';
import { AlignLeft } from 'lucide-react';
import { useTimelineContext } from '@/presentation/contexts/TimelineContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/presentation/components/shadcn/tooltip';

interface HoverablePlannerDateCellProps {
  date: Date;
  children: React.ReactNode;
}

export function HoverablePlannerDateCell({ date, children }: HoverablePlannerDateCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setCurrentView, setCurrentDate } = useTimelineContext();

  const handleClick = () => {
    // Navigate to timeline at the specified date
    setCurrentDate(new Date(date));
    setCurrentView('timeline');
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
            
            {/* Minimal hover overlay with timeline icon */}
            {isHovered && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                  <AlignLeft size={12} className="text-blue-600" />
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Go to Timeline</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
