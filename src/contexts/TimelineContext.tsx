import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface TimelineContextType {
  // Timeline View State
  timelineMode: 'days' | 'weeks';
  setTimelineMode: (mode: 'days' | 'weeks') => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  
  // Timeline Entries (legacy - to be refactored)
  timelineEntries: any[];
  updateTimelineEntry: (entry: any) => void;
  
  // Timeline Navigation
  navigateToToday: () => void;
  navigateByDays: (days: number) => void;
  navigateByWeeks: (weeks: number) => void;
  
  // Timeline Utilities
  getVisibleDateRange: () => { start: Date; end: Date };
  isDateInView: (date: Date) => boolean;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  // Timeline view state
  const [timelineMode, setTimelineMode] = useState<'days' | 'weeks'>('days');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);

  // Timeline navigation functions
  const navigateToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const navigateByDays = useCallback((days: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + days);
      return newDate;
    });
  }, []);

  const navigateByWeeks = useCallback((weeks: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (weeks * 7));
      return newDate;
    });
  }, []);

  // Timeline utility functions
  const getVisibleDateRange = useCallback((): { start: Date; end: Date } => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (timelineMode === 'weeks') {
      // Show multiple weeks
      start.setDate(currentDate.getDate() - 14); // 2 weeks before
      end.setDate(currentDate.getDate() + 14);   // 2 weeks after
    } else {
      // Show multiple days
      start.setDate(currentDate.getDate() - 7);  // 1 week before
      end.setDate(currentDate.getDate() + 7);    // 1 week after
    }
    
    return { start, end };
  }, [currentDate, timelineMode]);

  const isDateInView = useCallback((date: Date): boolean => {
    const { start, end } = getVisibleDateRange();
    return date >= start && date <= end;
  }, [getVisibleDateRange]);

  // Timeline entries management (legacy - to be refactored)
  const updateTimelineEntry = useCallback((entry: any) => {
    setTimelineEntries(prev => {
      const index = prev.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...entry };
        return updated;
      }
      return [...prev, entry];
    });
  }, []);

  const contextValue: TimelineContextType = {
    // Timeline View State
    timelineMode,
    setTimelineMode,
    currentDate,
    setCurrentDate,
    
    // Timeline Entries (legacy)
    timelineEntries,
    updateTimelineEntry,
    
    // Timeline Navigation
    navigateToToday,
    navigateByDays,
    navigateByWeeks,
    
    // Timeline Utilities
    getVisibleDateRange,
    isDateInView,
  };

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error('useTimelineContext must be used within a TimelineProvider');
  }
  return context;
}
