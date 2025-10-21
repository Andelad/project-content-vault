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
        backgroundColor: isExpanded && isTracking ? '#fecaca' : '#f9fafb', // red-200 when tracking and expanded, gray-50 otherwise
        borderColor: isExpanded && isTracking ? 'rgba(226, 226, 226, 0)' : '#e2e2e2',
      }}
      aria-label="Toggle time tracker"
    >
      <div className="relative flex items-center justify-center h-full pt-2">
        <Timer className="h-6 w-6 text-[#595956] stroke-[1.5]" />
        {isTracking && (
          <div className="absolute top-2 right-4">
            <div className="relative w-3 h-3">
              {/* Pulsing animation circle */}
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              {/* Solid circle */}
              <div className="relative w-3 h-3 bg-red-500 rounded-full" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
