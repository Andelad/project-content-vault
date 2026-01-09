import React from 'react';
import { Timer } from 'lucide-react';

interface TimeTrackerBookmarkProps {
  isTracking: boolean;
  onClick: () => void;
  isExpanded?: boolean;
}

export function TimeTrackerBookmark({ isTracking, onClick, isExpanded }: TimeTrackerBookmarkProps) {
  return (
    <button
      onClick={onClick}
      className="border-x border-b transition-all duration-500 ease-out"
      style={{
        width: '80px', // Same as current tracker height (h-20 = 80px)
        height: '53px', // Extra 1px to cover the tracker border
        borderRadius: '0 0 16px 16px',
        backgroundColor: isExpanded && isTracking ? '#fecaca' : '#f5f5f4', // red-200 when tracking and expanded, stone-100 (sidebar color) otherwise
        borderColor: isExpanded && isTracking ? 'rgba(229, 229, 229, 0)' : '#e5e5e5',
      }}
      aria-label="Toggle time tracker"
    >
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative">
          <Timer className="h-6 w-6 text-foreground stroke-[1.5]" />
          {isTracking && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </button>
  );
}
