import React, { memo } from 'react';

interface AvailabilitySidebarProps {
  collapsed: boolean;
  dates?: Date[];
}

export const AvailabilitySidebar = memo(function AvailabilitySidebar({ 
  collapsed,
  dates = []
}: AvailabilitySidebarProps) {
  return (
    <div 
      className="bg-white border-r border-gray-200"
      style={{ 
        width: collapsed ? '48px' : '280px',
        minWidth: collapsed ? '48px' : '280px',
        maxWidth: collapsed ? '48px' : '280px',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Availability Items */}
      <div className="flex-1 min-h-0">
        {/* Available Hours Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-green-500" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-800">Work Hours</span>
            </div>
          )}
        </div>
        
        {/* Overbooked Hours Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-red-500" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-gray-800">Overcommitted</span>
            </div>
          )}
        </div>

        {/* Overtime Planned/Completed Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-gray-400" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm font-medium text-gray-800">Overtime Planned</span>
            </div>
          )}
        </div>

        {/* Planned/Completed Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-gray-500" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span className="text-sm font-medium text-gray-800">Total Project Planned</span>
            </div>
          )}
        </div>

        {/* Other Time Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span className="text-sm font-medium text-gray-800">Other Time</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});