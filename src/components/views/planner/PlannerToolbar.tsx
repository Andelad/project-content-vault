import React from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DatePickerButton } from '@/components/shared/DatePickerButton';
import { HelpButton } from '@/components/shared/HelpButton';
import { ChevronLeft, ChevronRight, MapPin, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { LayersPopover } from './LayersPopover';

interface LayerVisibility {
  events: boolean;
  habits: boolean;
  tasks: boolean;
  workHours: boolean;
}

interface PlannerToolbarProps {
  currentView: 'week' | 'day';
  onViewChange: (view: 'week' | 'day') => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  formatDateRange: () => string;
  calendarDate: Date;
  isDatePickerOpen: boolean;
  onDatePickerOpenChange: (open: boolean) => void;
  onDateSelect: (date: Date | undefined) => void;
  isLayersPopoverOpen: boolean;
  onLayersPopoverOpenChange: (open: boolean) => void;
  layerVisibility: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  isCompactView: boolean;
  onToggleCompactView: () => void;
  onHelpClick: () => void;
}

export function PlannerToolbar({
  currentView,
  onViewChange,
  onNavigate,
  formatDateRange,
  calendarDate,
  isDatePickerOpen,
  onDatePickerOpenChange,
  onDateSelect,
  isLayersPopoverOpen,
  onLayersPopoverOpenChange,
  layerVisibility,
  onToggleLayer,
  isCompactView,
  onToggleCompactView,
  onHelpClick,
}: PlannerToolbarProps) {
  return (
    <div className="px-6 p-[21px]">
      <div className="flex items-center justify-between">
        {/* Left side controls */}
        <div className="flex items-center" style={{ gap: '21px' }}>
          {/* View Toggle */}
          <ToggleGroup
            type="single"
            value={currentView}
            onValueChange={(value) => {
              if (value) {
                onViewChange(value as 'week' | 'day');
              }
            }}
            variant="outline"
            className="border border-gray-200 rounded-lg h-9 p-1"
          >
            <ToggleGroupItem value="week" aria-label="Week mode" className="px-3 py-1 h-7">
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="day" aria-label="Day mode" className="px-3 py-1 h-7">
              Day
            </ToggleGroupItem>
          </ToggleGroup>
          
          {/* Today Button */}
          <Button variant="outline" onClick={() => onNavigate('today')} className="h-9 gap-2">
            <MapPin className="w-4 h-4" />
            Today
          </Button>
          
          {/* Date Picker */}
          <DatePickerButton
            selected={calendarDate}
            onSelect={onDateSelect}
            isOpen={isDatePickerOpen}
            onOpenChange={onDatePickerOpenChange}
          />
          
          {/* Layers Popover */}
          <LayersPopover
            isOpen={isLayersPopoverOpen}
            onOpenChange={onLayersPopoverOpenChange}
            layerVisibility={layerVisibility}
            onToggleLayer={onToggleLayer}
          />
          
          {/* Compact View Toggle */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={onToggleCompactView}
            title={isCompactView ? "Expand view" : "Compact view"}
          >
            {isCompactView ? (
              <ChevronsUpDown className="w-4 h-4" />
            ) : (
              <ChevronsDownUp className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Right side navigation */}
        <div className="flex items-center gap-3">
          <HelpButton onClick={onHelpClick} />
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => onNavigate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-semibold text-gray-900 text-center px-2">
              {formatDateRange()}
            </h2>
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => onNavigate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
