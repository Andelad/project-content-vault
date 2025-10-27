import React, { useState, useEffect } from 'react';
import { TimeTracker } from '../work-hours/TimeTracker';
import { TimeTrackerBookmark } from '../work-hours/TimeTrackerBookmark';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface AppHeaderProps {
  currentView: string;
  viewTitle: string;
  lastAction?: any;
  isTrackerExpanded?: boolean;
  onToggleTracker?: () => void;
}

export function AppHeader({ 
  currentView, 
  viewTitle, 
  lastAction,
  isTrackerExpanded = false,
  onToggleTracker
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
          className="fixed top-0 left-0 right-0 z-40 border-b border-[#e2e2e2] transition-all duration-500 ease-out"
          style={{
            transform: isTrackerExpanded ? 'translateY(0)' : 'translateY(-100%)',
            height: '84px',
            backgroundColor: isTrackerExpanded && isTimeTracking ? '#fecaca' : '#f9fafb', // red-200 when tracking and expanded, gray-50 otherwise
            borderBottomColor: isTrackerExpanded && isTimeTracking ? 'rgba(226, 226, 226, 0)' : '#e2e2e2',
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
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8 bg-gray-50 relative">
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
          <h1 className="text-lg font-semibold text-[#595956]">{viewTitle}</h1>
        </div>
        
        {/* Desktop TimeTracker */}
        {!isTablet && <TimeTracker />}
      </div>
    </>
  );
}
