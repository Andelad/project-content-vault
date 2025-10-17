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
  return null; // Header now handled by AppHeader in MainAppLayout
});