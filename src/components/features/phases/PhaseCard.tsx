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
import type { LocalMilestone } from '@/hooks/milestone';

interface PhaseCardProps {
  milestone: Milestone | LocalMilestone;
  projectEstimatedHours: number;
  projectContinuous: boolean;
  allPhases: (Milestone | LocalMilestone)[];
  isFirst: boolean;
  isLast: boolean;
  editingProperty: string | null;
  onEditPropertyChange: (property: string | null) => void;
  onUpdateProperty: (milestoneId: string, property: string, value: any) => void;
  onDelete: (milestoneId: string) => void;
}

/**
 * Pure UI component for displaying and editing a phase milestone
 * Phases have start and end dates with constraints based on adjacent phases
 */
export function PhaseCard({
  milestone,
  projectEstimatedHours,
  projectContinuous,
  allPhases,
  isFirst,
  isLast,
  editingProperty,
  onEditPropertyChange,
  onUpdateProperty,
  onDelete
}: PhaseCardProps) {
  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  const renderDateField = (property: 'startDate' | 'endDate') => {
    const dateValue = property === 'startDate' ? milestone.startDate : (milestone.endDate || milestone.dueDate);
    const displayValue = dateValue ? format(new Date(dateValue), 'MMM dd') : 'Select date';
    const isFixed = (property === 'startDate' && isFirst) || (property === 'endDate' && isLast);

    if (isFixed) {
      return (
        <div className="min-w-[100px]">
          <Label className="text-xs mb-1 block text-muted-foreground/50">
            {property === 'startDate' ? 'Start' : 'End'}
          </Label>
          <div className="h-10 text-sm px-3 border border-input rounded-md bg-muted/30 flex items-center cursor-not-allowed opacity-60">
            <CalendarIcon className="mr-2 h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground/70">{displayValue}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-w-[100px]">
        <Label className="text-xs text-muted-foreground mb-1 block">
          {property === 'startDate' ? 'Start' : 'End'}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 text-sm justify-start text-left font-normal px-3"
              style={{ width: '100px' }}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {displayValue}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue ? new Date(dateValue) : undefined}
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  onUpdateProperty(milestone.id!, property, selectedDate);
                }
              }}
              disabled={(date) => {
                const currentIndex = allPhases.findIndex(p => p.id === milestone.id);
                
                if (property === 'startDate') {
                  const prevPhase = currentIndex > 0 ? allPhases[currentIndex - 1] : null;
                  const currentEnd = new Date(milestone.endDate || milestone.dueDate);
                  
                  if (prevPhase) {
                    const prevEnd = new Date(prevPhase.endDate || prevPhase.dueDate);
                    return date < prevEnd || date >= currentEnd;
                  }
                  return date >= currentEnd;
                } else {
                  const nextPhase = currentIndex < allPhases.length - 1 ? allPhases[currentIndex + 1] : null;
                  const currentStart = new Date(milestone.startDate!);
                  
                  if (nextPhase) {
                    const nextStart = new Date(nextPhase.startDate!);
                    return date <= currentStart || date >= nextStart;
                  }
                  return date <= currentStart;
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
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
                placeholder="Phase name"
                className="h-10 text-sm border-border bg-background"
                style={{ width: `${Math.max((milestone.name || 'Phase name').length * 8 + 40, 120)}px` }}
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
                style={{ width: `${Math.max((milestone.name || 'Phase name').length * 8 + 40, 120)}px` }}
                onClick={() => onEditPropertyChange(`${milestone.id}-name`)}
              >
                {milestone.name || 'Phase name'}
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

        {/* Right side: Start Date, End Date, and Delete Button */}
        <div className="flex items-end gap-3">
          {renderDateField('startDate')}
          <span className="text-muted-foreground mb-2">→</span>
          {renderDateField('endDate')}

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
                <AlertDialogTitle>Delete Phase</AlertDialogTitle>
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
                  Delete Phase
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
