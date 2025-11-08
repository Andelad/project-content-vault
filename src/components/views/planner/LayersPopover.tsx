import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Layers2, CalendarDays, Eye, EyeOff, Clock } from 'lucide-react';
import { HABIT_ICON, TASK_ICON } from '@/constants/icons';

interface LayerVisibility {
  events: boolean;
  habits: boolean;
  tasks: boolean;
  workHours: boolean;
}

interface LayersPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  layerVisibility: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
}

export function LayersPopover({
  isOpen,
  onOpenChange,
  layerVisibility,
  onToggleLayer,
}: LayersPopoverProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Layers2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {/* Events Layer */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
            onClick={() => onToggleLayer('events')}
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm font-medium">Events</span>
            </div>
            {layerVisibility.events ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Habits Layer */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
            onClick={() => onToggleLayer('habits')}
          >
            <div className="flex items-center gap-2">
              <HABIT_ICON className="w-4 h-4" />
              <span className="text-sm font-medium">Habits</span>
            </div>
            {layerVisibility.habits ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Tasks Layer */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
            onClick={() => onToggleLayer('tasks')}
          >
            <div className="flex items-center gap-2">
              <TASK_ICON className="w-4 h-4" />
              <span className="text-sm font-medium">Quick Tasks</span>
            </div>
            {layerVisibility.tasks ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Work Hours Layer */}
          <div
            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
            onClick={() => onToggleLayer('workHours')}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Work Hours</span>
            </div>
            {layerVisibility.workHours ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
