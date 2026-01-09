import React, { useState } from 'react';
import { Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/presentation/components/shadcn/input';
import { Button } from '@/presentation/components/shadcn/button';
import { Label } from '@/presentation/components/shadcn/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/shadcn/popover';
import { Calendar } from '@/presentation/components/shadcn/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/presentation/components/shadcn/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/presentation/components/shadcn/alert-dialog';
import type { PhaseDTO } from '@/shared/types/core';
import type { LocalPhase } from '@/presentation/hooks/phase';

interface PhaseCardProps {
  phase: PhaseDTO | LocalPhase;
  projectEstimatedHours: number;
  projectContinuous: boolean;
  allPhases: (PhaseDTO | LocalPhase)[];
  isFirst: boolean;
  isLast: boolean;
  editingProperty: string | null;
  onEditPropertyChange: (property: string | null) => void;
  onUpdateProperty: (phaseId: string, property: string, value: string | number | Date) => void;
  onDelete: (phaseId: string) => void;
}

/**
 * Pure UI component for displaying and editing a phase phase
 * Phases have start and end dates with constraints based on adjacent phases
 */
export function PhaseCard({
  phase: phase,
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
    const dateValue = property === 'startDate' ? phase.startDate : (phase.endDate || phase.dueDate);
    const displayValue = dateValue ? format(new Date(dateValue), 'MMM dd') : 'Select date';
    const willUpdateProject = (property === 'startDate' && isFirst) || (property === 'endDate' && isLast);

    const tooltipText = willUpdateProject
      ? property === 'startDate'
        ? 'Also updates project start date'
        : 'Also updates project end date'
      : undefined;

    return (
      <div className="min-w-[100px]">
        <Label className="text-xs text-muted-foreground mb-1 block">
          {property === 'startDate' ? 'Start' : 'End'}
          {willUpdateProject && <span className="text-primary ml-1">*</span>}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
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
                    defaultMonth={dateValue ? new Date(dateValue) : undefined}
                    onSelect={(selectedDate) => {
                      if (selectedDate) {
                        onUpdateProperty(phase.id!, property, selectedDate);
                      }
                    }}
                    disabled={(date) => {
                      const currentIndex = allPhases.findIndex(p => p.id === phase.id);
                      
                      if (property === 'startDate') {
                        const prevPhase = currentIndex > 0 ? allPhases[currentIndex - 1] : null;
                        const currentEnd = new Date(phase.endDate || phase.dueDate);
                        
                        if (prevPhase) {
                          const prevEnd = new Date(prevPhase.endDate || prevPhase.dueDate);
                          return date < prevEnd || date >= currentEnd;
                        }
                        return date >= currentEnd;
                      } else {
                        const nextPhase = currentIndex < allPhases.length - 1 ? allPhases[currentIndex + 1] : null;
                        const currentStart = new Date(phase.startDate!);
                        
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
            </TooltipTrigger>
            {tooltipText && (
              <TooltipContent>
                <p>{tooltipText}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
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
            {editingProperty === `${phase.id}-name` ? (
              <Input
                type="text"
                defaultValue={phase.name}
                placeholder="Phase name"
                className="h-10 text-sm border-border bg-background"
                style={{ width: `${Math.max((phase.name || 'Phase name').length * 8 + 40, 120)}px` }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newValue = (e.target as HTMLInputElement).value;
                    onUpdateProperty(phase.id!, 'name', newValue);
                    onEditPropertyChange(null);
                  } else if (e.key === 'Escape') {
                    onEditPropertyChange(null);
                  }
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  onUpdateProperty(phase.id!, 'name', newValue);
                  onEditPropertyChange(null);
                }}
                autoFocus
              />
            ) : (
              <Button
                variant="outline"
                className="h-10 text-sm justify-start text-left font-normal px-3"
                style={{ width: `${Math.max((phase.name || 'Phase name').length * 8 + 40, 120)}px` }}
                onClick={() => onEditPropertyChange(`${phase.id}-name`)}
              >
                {phase.name || 'Phase name'}
              </Button>
            )}
          </div>

          {/* Budget Field */}
          <div className="min-w-[80px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Estimate (hrs)</Label>
            <div className="flex items-center gap-1">
              {editingProperty === `${phase.id}-timeAllocation` ? (
                <Input
                  type="number"
                  defaultValue={phase.timeAllocation}
                  className="h-10 text-sm border-border bg-background"
                  style={{ width: `${Math.max(phase.timeAllocation.toString().length * 12 + 60, 80)}px` }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newValue = parseFloat((e.target as HTMLInputElement).value) || 0;
                      onUpdateProperty(phase.id!, 'timeAllocation', newValue);
                      onEditPropertyChange(null);
                    } else if (e.key === 'Escape') {
                      onEditPropertyChange(null);
                    }
                  }}
                  onBlur={(e) => {
                    const newValue = parseFloat(e.target.value) || 0;
                    onUpdateProperty(phase.id!, 'timeAllocation', newValue);
                    onEditPropertyChange(null);
                  }}
                  autoFocus
                />
              ) : (
                <Button
                  variant="outline"
                  className="h-10 text-sm justify-start text-left font-normal px-3"
                  style={{ width: `${Math.max(`${phase.timeAllocation}h`.length * 8 + 40, 80)}px` }}
                  onClick={() => onEditPropertyChange(`${phase.id}-timeAllocation`)}
                >
                  {phase.timeAllocation}h
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
                  Are you sure you want to delete "{phase.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => phase.id && onDelete(phase.id)}
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
