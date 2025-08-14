import React from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/contexts/AppStateContext';
import { useAppActions } from '@/contexts/AppActionsContext';
import { Edit3, Trash2, Clock } from 'lucide-react';

interface TimelineBarProps {
  selectedDate: Date;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({ selectedDate }) => {
  const { state } = useAppState();
  const { updateTimeSlot, deleteTimeSlot } = useAppActions();

  const daySlots = state.timeSlots.filter(slot => 
    isSameDay(parseISO(slot.date), selectedDate)
  );

  const sortedSlots = daySlots.sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );

  const timeSlots = Array.from({ length: 24 }, (_, hour) => {
    const timeString = `${hour.toString().padStart(2, '0')}:00`;
    const existingSlot = sortedSlots.find(slot => 
      slot.startTime <= timeString && slot.endTime > timeString
    );
    return { hour, timeString, slot: existingSlot };
  });

  const handleToggleAvailability = (slotId: string, isAvailable: boolean) => {
    updateTimeSlot(slotId, { isAvailable: !isAvailable });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <Badge variant="outline" className="text-muted-foreground">
          {sortedSlots.length} events
        </Badge>
      </div>

      <div className="relative">
        {/* Time grid */}
        <div className="space-y-1">
          {timeSlots.map(({ hour, timeString, slot }) => (
            <div key={hour} className="relative flex items-center">
              {/* Time label */}
              <div className="w-16 text-sm text-muted-foreground font-mono">
                {timeString}
              </div>
              
              {/* Timeline slot */}
              <div className="flex-1 h-12 relative">
                {slot ? (
                  <Card className="absolute inset-y-1 left-2 right-0 p-3 border-l-4 border-l-primary bg-gradient-card hover:shadow-medium transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {slot.title || 'Untitled Event'}
                          </span>
                          <Badge 
                            variant={slot.isAvailable ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {slot.isAvailable ? 'Available' : 'Busy'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {slot.startTime} - {slot.endTime}
                          {slot.description && ` • ${slot.description}`}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleAvailability(slot.id, slot.isAvailable)}
                          className="h-7 w-7 p-0"
                        >
                          <Badge 
                            variant={slot.isAvailable ? "default" : "secondary"}
                            className="h-2 w-2 p-0"
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {/* Edit functionality */}}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTimeSlot(slot.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="absolute inset-y-4 left-2 right-0 border-t border-border opacity-20" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};