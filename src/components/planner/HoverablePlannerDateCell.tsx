import React, { useState } from 'react';
import { AlignLeft } from 'lucide-react';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HoverablePlannerDateCellProps {
  date: Date;
  children: React.ReactNode;
  className?: string;
}

export function HoverablePlannerDateCell({ date, children, className = '' }: HoverablePlannerDateCellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setCurrentView, setCurrentDate } = useTimelineContext();

  const handleClick = () => {
    // Navigate to timeline at the specified date
    // Set date first, then view to ensure timeline loads at the correct date
    setCurrentDate(new Date(date));
    // Use setTimeout to ensure date is set before view change
    setTimeout(() => {
      setCurrentView('timeline');
    }, 0);
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={`relative cursor-pointer h-full w-full ${className}`}
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
