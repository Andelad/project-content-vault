import React, { useState, useEffect } from 'react';
import { TimeTracker } from '../features/tracker/TimeTracker';
import { TimeTrackerBookmark } from '../features/tracker/TimeTrackerBookmark';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';

interface AppHeaderProps {
  currentView: string;
  viewTitle: string;
  lastAction?: any;
  isTrackerExpanded?: boolean;
  onToggleTracker?: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export function AppHeader({ 
  currentView, 
  viewTitle, 
  lastAction,
  isTrackerExpanded = false,
  onToggleTracker,
  setMobileMenuOpen
}: AppHeaderProps) {
  const { isTimeTracking } = useSettingsContext();
  const [isTablet, setIsTablet] = useState(false);

  // Detect tablet size (< 768px)
  useEffect(() => {
    const checkTablet = () => {
      setIsTablet(window.innerWidth < 768);
    };
    
    checkTablet();
    window.addEventListener('resize', checkTablet);
    
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  return (
    <>
      {/* Time Tracker - slides down on tablet */}
      {isTablet && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 border-b transition-all duration-500 ease-out"
          style={{
            transform: isTrackerExpanded ? 'translateY(0)' : 'translateY(-100%)',
            height: '84px',
            backgroundColor: isTrackerExpanded && isTimeTracking ? '#fecaca' : '#f5f5f4', // red-200 when tracking and expanded, stone-100 (sidebar color) otherwise
            borderBottomColor: isTrackerExpanded && isTimeTracking ? 'rgba(229, 229, 229, 0)' : '#e5e5e5',
          }}
        >
          <div className="w-full p-3 h-full flex items-center">
            <TimeTracker 
              isExpanded={isTrackerExpanded}
              onToggleExpanded={onToggleTracker}
              className="w-full"
              fadeBorder={isTrackerExpanded && isTimeTracking}
            />
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="h-20 border-b border-[#e5e5e5] flex items-center justify-between px-8 bg-[#fcfcfc] relative">
        {/* Bookmark for tablet view - positioned at top of header, overlaps tracker border */}
        {isTablet && (
          <div className="absolute -top-px right-8 z-50">
            <TimeTrackerBookmark 
              isTracking={isTimeTracking}
              onClick={onToggleTracker || (() => {})}
              isExpanded={isTrackerExpanded}
            />
          </div>
        )}
        
        <div className="flex items-center space-x-4">
          {/* Mobile hamburger menu */}
          {isTablet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
          
          {/* Logo on mobile */}
          {isTablet && (
            <img src="/lovable-uploads/b7b3f5f1-d45e-4fc7-9113-f39c988b4951.png" alt="Budgi Logo" className="w-5 h-5" />
          )}
          
          <h1 className="text-lg font-semibold text-foreground">{viewTitle}</h1>
        </div>
        
        {/* Desktop TimeTracker */}
        {!isTablet && <TimeTracker />}
      </div>
    </>
  );
}
