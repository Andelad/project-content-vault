import React from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/contexts/AppStateContext';
import { useAppActions } from '@/contexts/AppActionsContext';
import { cn } from '@/lib/utils';

interface AvailabilityCirclesProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const AvailabilityCircles: React.FC<AvailabilityCirclesProps> = ({
  selectedDate,
  onDateSelect,
}) => {
  const { state } = useAppState();
  const { setSelectedDate } = useAppActions();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAvailabilityForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const daySlots = state.timeSlots.filter(slot => slot.date === dateString);
    const availableSlots = daySlots.filter(slot => slot.isAvailable);
    const totalSlots = daySlots.length;
    
    return {
      available: availableSlots.length,
      total: totalSlots,
      percentage: totalSlots > 0 ? (availableSlots.length / totalSlots) * 100 : 0,
    };
  };

  const getAvailabilityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500 bg-green-50 border-green-200';
    if (percentage >= 50) return 'text-amber-500 bg-amber-50 border-amber-200';
    if (percentage > 0) return 'text-red-500 bg-red-50 border-red-200';
    return 'text-muted-foreground bg-muted border-border';
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect(date);
  };

  return (
    <Card className="p-6 bg-gradient-card">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Weekly Availability</h3>
          <Badge variant="outline" className="text-muted-foreground">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
          </Badge>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date) => {
            const availability = getAvailabilityForDate(date);
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());

            return (
              <Button
                key={date.toISOString()}
                variant="ghost"
                onClick={() => handleDateClick(date)}
                className={cn(
                  "flex flex-col items-center p-3 h-auto space-y-2 relative transition-all duration-300",
                  isSelected && "ring-2 ring-primary bg-primary/5",
                  "hover:bg-muted/50"
                )}
              >
                {/* Day label */}
                <span className="text-xs font-medium text-muted-foreground">
                  {format(date, 'EEE')}
                </span>
                
                {/* Date and availability circle */}
                <div className="relative">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-300",
                      getAvailabilityColor(availability.percentage),
                      isSelected && "scale-110 shadow-medium"
                    )}
                  >
                    {format(date, 'd')}
                    {isToday && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
                  
                  {/* Availability indicator */}
                  {availability.total > 0 && (
                    <div className="absolute -bottom-1 -right-1">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold",
                          getAvailabilityColor(availability.percentage)
                        )}
                      >
                        {availability.available}
                      </div>
                    </div>
                  )}
                </div>

                {/* Availability percentage */}
                {availability.total > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {Math.round(availability.percentage)}%
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-4 pt-2 border-t border-border">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">High</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Low</span>
          </div>
        </div>
      </div>
    </Card>
  );
};