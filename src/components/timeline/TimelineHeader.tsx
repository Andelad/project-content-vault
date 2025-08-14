import React, { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

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
    <div className="h-20 border-b border-[#e2e2e2] flex items-center px-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-[#595956]">Timeline +</h1>
      </div>
    </div>
  );
});