import React, { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { TimeTracker } from '../TimeTracker';

interface TimelineHeaderProps {
  currentDate: Date;
  viewportStart: Date;
  viewportEnd: Date;
  onNavigate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
}

export const TimelineHeader = memo(function TimelineHeader({ 
  currentDate, 
  viewportStart, 
  viewportEnd, 
  onNavigate, 
  onGoToToday 
}: TimelineHeaderProps) {
  return (
    <div className="h-20 border-b border-border flex items-center justify-between px-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-foreground">Timeline</h1>
      </div>
      
      {/* Time Tracker in top right */}
      <TimeTracker />
    </div>
  );
});