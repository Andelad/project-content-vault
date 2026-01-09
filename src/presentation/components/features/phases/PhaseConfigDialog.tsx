import React, { useState } from 'react';
import { Input } from '@/presentation/components/shadcn/input';
import { Label } from '@/presentation/components/shadcn/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/shadcn/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/presentation/components/shadcn/alert-dialog';
import { getDayName, getOrdinalNumber, getWeekOfMonthName } from '@/presentation/utils/dateFormatUtils';
import { cn } from '@/presentation/lib/utils';
import type { RecurringPhaseConfig } from '@/presentation/hooks/phase';

interface PhaseConfigDialogProps {
  type: 'recurring' | 'split' | 'recurring-warning' | 'split-warning' | 'recurring-from-split-warning' | 'split-from-recurring-warning';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectStartDate: Date;
  projectContinuous: boolean;
  // For recurring config
  config?: RecurringPhaseConfig;
  onConfigChange?: (config: RecurringPhaseConfig) => void;
  // For budget replacement warning
  projectEstimatedHours?: number;
  // Optional z-index override
  zIndex?: number;
  // Is this editing an existing config or creating new?
  isEditing?: boolean;
}

/**
 * Pure UI component for phase configuration dialogs
 * Handles recurring template configuration and warning dialogs
 */
export function PhaseConfigDialog({
  type,
  open,
  onOpenChange,
  onConfirm,
  projectStartDate,
  projectContinuous,
  config,
  onConfigChange,
  projectEstimatedHours,
  zIndex,
  isEditing
}: PhaseConfigDialogProps) {
  // Recurring configuration dialog
  if (type === 'recurring' && config && onConfigChange) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent 
          className="max-w-md"
          style={zIndex ? { zIndex } : undefined}
          overlayStyle={zIndex ? { zIndex: zIndex - 1 } : undefined}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Configure Recurring Template</AlertDialogTitle>
            <AlertDialogDescription>
              Set up a template that repeats at regular intervals throughout your project timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="time-allocation">Time Allocation (hours)</Label>
              <Input
                id="time-allocation"
                type="number"
                min="1"
                value={config.timeAllocation}
                onChange={(e) => onConfigChange({ ...config, timeAllocation: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div>
              <Label htmlFor="phase-name">Phase Name</Label>
              <Input
                id="phase-name"
                value={config.name}
                onChange={(e) => onConfigChange({ ...config, name: e.target.value })}
                placeholder={`e.g., ${config.recurringType.charAt(0).toUpperCase() + config.recurringType.slice(1)}`}
              />
            </div>

            <div>
              <Label htmlFor="recurring-type">Repeat</Label>
              <Select
                value={config.recurringType}
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
                  // Auto-update name when pattern changes
                  const patternName = value.charAt(0).toUpperCase() + value.slice(1);
                  onConfigChange({ 
                    ...config, 
                    recurringType: value,
                    name: patternName
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recurring-interval">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="recurring-interval"
                  type="number"
                  min="1"
                  value={config.recurringInterval}
                  onChange={(e) =>
                    onConfigChange({ ...config, recurringInterval: parseInt(e.target.value) || 1 })
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {config.recurringType}(s)
                </span>
              </div>
            </div>

            {/* Weekly day selection */}
            {config.recurringType === 'weekly' && (
              <div>
                <Label htmlFor="weekly-day">On day</Label>
                <Select
                  key={`weekly-day-${config.weeklyDayOfWeek}-${open}`}
                  value={config.weeklyDayOfWeek?.toString() || "1"}
                  onValueChange={(value) => {
                    onConfigChange({ ...config, weeklyDayOfWeek: parseInt(value) });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Monthly pattern selection */}
            {config.recurringType === 'monthly' && (
              <div className="space-y-3">
                <div>
                  <Label>Monthly pattern</Label>
                  <Select
                    value={config.monthlyPattern}
                    onValueChange={(value: 'date' | 'dayOfWeek') =>
                      onConfigChange({ ...config, monthlyPattern: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Specific date</SelectItem>
                      <SelectItem value="dayOfWeek">Day of week pattern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.monthlyPattern === 'date' && (
                  <div>
                    <Label htmlFor="monthly-date">On the</Label>
                    <Select
                      value={config.monthlyDate?.toString()}
                      onValueChange={(value) =>
                        onConfigChange({ ...config, monthlyDate: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => (
                          <SelectItem key={date} value={date.toString()}>
                            {getOrdinalNumber(date)} of the month
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {config.monthlyPattern === 'dayOfWeek' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Week of month</Label>
                      <Select
                        value={config.monthlyWeekOfMonth?.toString()}
                        onValueChange={(value) =>
                          onConfigChange({ ...config, monthlyWeekOfMonth: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1st week</SelectItem>
                          <SelectItem value="2">2nd week</SelectItem>
                          <SelectItem value="3">3rd week</SelectItem>
                          <SelectItem value="4">4th week</SelectItem>
                          <SelectItem value="5">2nd last week</SelectItem>
                          <SelectItem value="6">Last week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Day of week</Label>
                      <Select
                        value={config.monthlyDayOfWeek?.toString()}
                        onValueChange={(value) =>
                          onConfigChange({ ...config, monthlyDayOfWeek: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
              <strong>Preview:</strong> {config.name} phases will be created{' '}
              {config.recurringType === 'daily'
                ? `every ${config.recurringInterval} day${config.recurringInterval > 1 ? 's' : ''}`
                : config.recurringType === 'weekly'
                ? `every ${config.recurringInterval} week${
                    config.recurringInterval > 1 ? 's' : ''
                  } on ${getDayName(config.weeklyDayOfWeek || 1)}`
                : config.monthlyPattern === 'date'
                ? `every ${config.recurringInterval} month${
                    config.recurringInterval > 1 ? 's' : ''
                  } on the ${getOrdinalNumber(config.monthlyDate || 1)}`
                : `every ${config.recurringInterval} month${
                    config.recurringInterval > 1 ? 's' : ''
                  } on the ${getWeekOfMonthName(config.monthlyWeekOfMonth || 1)} ${getDayName(
                    config.monthlyDayOfWeek || 1
                  )}`}{' '}
              from the project start date
              {projectContinuous
                ? ' (continues indefinitely for continuous projects)'
                : ' until the project end date'}
              .
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              {isEditing ? 'Update Recurring Template' : 'Create Recurring Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Warning dialogs
  const budgetText = projectEstimatedHours 
    ? ` (${projectEstimatedHours}h)`
    : '';

  const warningConfig = {
    'recurring-warning': {
      title: 'Replace Budget with Recurring Template?',
      description:
        `Creating a recurring template will replace your fixed project budget${budgetText} with a recurring allocation. Any existing phases will be deleted.`,
      confirmText: 'Replace Budget & Continue',
      isDestructive: true
    },
    'split-warning': {
      title: 'Delete Existing Phases?',
      description:
        'This project has existing phases. Splitting the estimate will delete all existing phases and create new phases. This action cannot be undone.',
      confirmText: 'Delete & Split',
      isDestructive: true
    },
    'recurring-from-split-warning': {
      title: 'Replace Budget with Recurring Template?',
      description:
        `Creating a recurring template will delete manual phases and replace your fixed project budget.${budgetText} This action cannot be undone.`,
      confirmText: 'Replace Budget & Continue',
      isDestructive: true
    },
    'split-from-recurring-warning': {
      title: 'Replace Recurring Phase with Manual Phases?',
      description:
        'This project has a recurring phase template. Creating manual phases will delete the recurring template and all generated phases. This action cannot be undone.',
      confirmText: 'Delete Recurring & Create Phases',
      isDestructive: true
    }
  };

  const warning = warningConfig[type as keyof typeof warningConfig];
  if (!warning) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{warning.title}</AlertDialogTitle>
          <AlertDialogDescription>{warning.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {warning.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
