import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

interface TimelineContextType {
  // Timeline View State
  currentView: string;
  setCurrentView: (view: string) => void;
  timelineMode: 'days' | 'weeks';
  setTimelineMode: (mode: 'days' | 'weeks') => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  
  // Main App Sidebar State
  mainSidebarCollapsed: boolean;
  setMainSidebarCollapsed: (collapsed: boolean) => void;
  
  // Mobile Menu State
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  
  // Timeline Entries (legacy - to be refactored)
  timelineEntries: any[];
  updateTimelineEntry: (entry: any) => void;
  
  // Timeline Navigation
  navigateToToday: () => void;
  navigateByDays: (days: number) => void;
  navigateByWeeks: (weeks: number) => void;
  
  // Group Collapse State
  collapsedGroups: Set<string>;
  toggleGroupCollapse: (groupId: string) => void;
  
  // Timeline Utilities
  getVisibleDateRange: () => { start: Date; end: Date };
  isDateInView: (date: Date) => boolean;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  // Timeline view state - initialize from localStorage
  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const savedView = localStorage.getItem('currentView');
      return savedView || 'timeline';
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'TimelineContext', action: 'Failed to load currentView from localStorage:' });
      return 'timeline';
    }
  });
  const [timelineMode, setTimelineMode] = useState<'days' | 'weeks'>('days');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mainSidebarCollapsed, setMainSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Persist currentView to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('currentView', currentView);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'TimelineContext', action: 'Failed to save currentView to localStorage:' });
    }
  }, [currentView]);

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

  // Group collapse functionality
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
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
    currentView,
    setCurrentView,
    timelineMode,
    setTimelineMode,
    currentDate,
    setCurrentDate,
    
    // Main App Sidebar State
    mainSidebarCollapsed,
    setMainSidebarCollapsed,
    
    // Mobile Menu State
    mobileMenuOpen,
    setMobileMenuOpen,
    
    // Timeline Entries (legacy)
    timelineEntries,
    updateTimelineEntry,
    
    // Timeline Navigation
    navigateToToday,
    navigateByDays,
    navigateByWeeks,
    
    // Group Collapse State
    collapsedGroups,
    toggleGroupCollapse,
    
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
