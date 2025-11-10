import React, { useState } from 'react';
import { Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Milestone } from '@/types/core';
import { UnifiedMilestoneService } from '@/services';
import type { LocalMilestone } from '@/hooks/milestone';

interface MilestoneCardProps {
  milestone: Milestone | LocalMilestone;
  projectEstimatedHours: number;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous: boolean;
  existingMilestones: (Milestone | LocalMilestone)[];
  editingProperty: string | null;
  onEditPropertyChange: (property: string | null) => void;
  onUpdateProperty: (milestoneId: string, property: string, value: any) => void;
  onDelete: (milestoneId: string) => void;
}

/**
 * Pure UI component for displaying and editing a regular milestone
 * Handles inline editing for name, budget, and due date
 */
export function MilestoneCard({
  milestone,
  projectEstimatedHours,
  projectStartDate,
  projectEndDate,
  projectContinuous,
  existingMilestones,
  editingProperty,
  onEditPropertyChange,
  onUpdateProperty,
  onDelete
}: MilestoneCardProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Calculate valid date range using service
  const getValidDateRange = () => {
    const result = UnifiedMilestoneService.calculateMilestoneDateRange({
      projectStartDate,
      projectEndDate,
      existingMilestones,
      currentMilestone: milestone
    });
    return {
      minDate: result.minDate,
      maxDate: result.maxDate
    };
  };

  const { minDate, maxDate } = getValidDateRange();
  const isCurrentDateValid = milestone.dueDate >= minDate && milestone.dueDate <= maxDate;

  const getCalendarDefaultMonth = () => {
    if (isCurrentDateValid) return milestone.dueDate;
    if (milestone.dueDate < minDate) return minDate;
    if (milestone.dueDate > maxDate) return maxDate;
    return minDate;
  };

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3">
      <div className="flex items-end justify-between">
        {/* Left side: Name and Budget */}
        <div className="flex items-end gap-3">
          {/* Name Field */}
          <div className="min-w-[120px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
            {editingProperty === `${milestone.id}-name` ? (
              <Input
                type="text"
                defaultValue={milestone.name}
                placeholder="Milestone name"
                className="h-10 text-sm border-border bg-background"
                style={{ width: `${Math.max((milestone.name || 'Milestone name').length * 8 + 40, 120)}px` }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newValue = (e.target as HTMLInputElement).value;
                    onUpdateProperty(milestone.id!, 'name', newValue);
                    onEditPropertyChange(null);
                  } else if (e.key === 'Escape') {
                    onEditPropertyChange(null);
                  }
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  onUpdateProperty(milestone.id!, 'name', newValue);
                  onEditPropertyChange(null);
                }}
                autoFocus
              />
            ) : (
              <Button
                variant="outline"
                className="h-10 text-sm justify-start text-left font-normal px-3"
                style={{ width: `${Math.max((milestone.name || 'Milestone name').length * 8 + 40, 120)}px` }}
                onClick={() => onEditPropertyChange(`${milestone.id}-name`)}
              >
                {milestone.name || 'Milestone name'}
              </Button>
            )}
          </div>

          {/* Budget Field */}
          <div className="min-w-[80px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
            <div className="flex items-center gap-1">
              {editingProperty === `${milestone.id}-timeAllocation` ? (
                <Input
                  type="number"
                  defaultValue={milestone.timeAllocation}
                  className="h-10 text-sm border-border bg-background"
                  style={{ width: `${Math.max(milestone.timeAllocation.toString().length * 12 + 60, 80)}px` }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newValue = parseFloat((e.target as HTMLInputElement).value) || 0;
                      onUpdateProperty(milestone.id!, 'timeAllocation', newValue);
                      onEditPropertyChange(null);
                    } else if (e.key === 'Escape') {
                      onEditPropertyChange(null);
                    }
                  }}
                  onBlur={(e) => {
                    const newValue = parseFloat(e.target.value) || 0;
                    onUpdateProperty(milestone.id!, 'timeAllocation', newValue);
                    onEditPropertyChange(null);
                  }}
                  autoFocus
                />
              ) : (
                <Button
                  variant="outline"
                  className="h-10 text-sm justify-start text-left font-normal px-3"
                  style={{ width: `${Math.max(`${milestone.timeAllocation}h`.length * 8 + 40, 80)}px` }}
                  onClick={() => onEditPropertyChange(`${milestone.id}-timeAllocation`)}
                >
                  {milestone.timeAllocation}h
                </Button>
              )}
              {!projectContinuous && (
                <span className="text-xs text-muted-foreground/60">of {projectEstimatedHours}h</span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Date and Delete Button */}
        <div className="flex items-end gap-3">
          {/* Date Field */}
          <div className="min-w-[140px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 text-sm justify-start text-left font-normal px-3 w-full"
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {formatDate(milestone.dueDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b bg-gray-50">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Milestone Date Range
                  </div>
                  <div className="text-xs text-gray-600">
                    Must be between {formatDate(minDate)} and {formatDate(maxDate)}
                  </div>
                  {existingMilestones.filter(m => m.id !== milestone.id).length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Other milestones: {existingMilestones
                        .filter(m => m.id !== milestone.id)
                        .map(m => formatDate(m.dueDate))
                        .join(', ')}
                    </div>
                  )}
                </div>
                <Calendar
                  mode="single"
                  selected={milestone.dueDate}
                  defaultMonth={getCalendarDefaultMonth()}
                  onSelect={(selectedDate) => {
                    if (selectedDate) {
                      onUpdateProperty(milestone.id!, 'dueDate', selectedDate);
                      setIsCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => {
                    return date < minDate || date > maxDate;
                  }}
                  modifiers={{
                    otherMilestone: (date) => existingMilestones
                      .filter(m => m.id !== milestone.id)
                      .some(m => {
                        const mDate = new Date(m.dueDate);
                        return mDate.toDateString() === date.toDateString();
                      })
                  }}
                  modifiersStyles={{
                    otherMilestone: {
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: 'rgb(239, 68, 68)',
                      fontWeight: 'bold'
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Delete Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{milestone.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => milestone.id && onDelete(milestone.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Milestone
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
