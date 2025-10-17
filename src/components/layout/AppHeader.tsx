import React from 'react';
import { TimeTracker } from '../work-hours/TimeTracker';

interface AppHeaderProps {
  currentView: string;
  viewTitle: string;
  lastAction?: any;
}

export function AppHeader({ currentView, viewTitle, lastAction }: AppHeaderProps) {
  return (
    <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8 bg-gray-50">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold text-[#595956]">{viewTitle}</h1>
        {lastAction && (
          <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            <span>Press Cmd+Z to undo</span>
          </div>
        )}
      </div>
      <TimeTracker />
    </div>
  );
}
