import React, { memo, useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';

interface InfoButtonProps {
  title: string;
  description: string;
}

const InfoButton = ({ title, description }: InfoButtonProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 hover:bg-gray-50 text-gray-400 hover:text-gray-500"
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

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
        width: collapsed ? '64px' : '192px',
        minWidth: collapsed ? '64px' : '192px',
        maxWidth: collapsed ? '64px' : '192px',
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
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-800">Available Work Slots</span>
              </div>
              <InfoButton
                title="Available Work Slots"
                description="The number of work hours still available in this time period."
              />
            </div>
          )}
        </div>
        
        {/* Overbooked Hours Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-red-500" />
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-gray-800">Overcommitted</span>
              </div>
              <InfoButton
                title="Overcommitted"
                description="Where planned time is more than the total allowance for work in the column time period."
              />
            </div>
          )}
        </div>

        {/* Overtime Planned/Completed Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-orange-500" />
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm font-medium text-gray-800">Overtime</span>
              </div>
              <InfoButton
                title="Overtime"
                description="Project time completed or planned outside work hours."
              />
            </div>
          )}
        </div>

        {/* Planned/Completed Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-gray-500" />
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm font-medium text-gray-800">Total Project Time</span>
              </div>
              <InfoButton
                title="Total Project Time"
                description="The number of planned project events in total."
              />
            </div>
          )}
        </div>

        {/* Other Time Row */}
        <div className={`h-12 border-b border-gray-100 flex items-center ${collapsed ? 'px-0 justify-center' : 'px-4'}`}>
          {collapsed ? (
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-gray-800">Other Time</span>
              </div>
              <InfoButton
                title="Other Planned"
                description="Events planned that are not linked to a project."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});