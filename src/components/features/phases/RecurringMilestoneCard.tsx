import React, { useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { getDayName, getOrdinalNumber, getWeekOfMonthName } from '@/utils/dateFormatUtils';
import type { RecurringMilestone } from '@/hooks/milestone';

interface RecurringMilestoneCardProps {
  recurringMilestone: RecurringMilestone;
  projectEstimatedHours: number;
  projectContinuous: boolean;
  projectStartDate: Date;
  onUpdateLoad: (newLoad: number) => Promise<void>;
  onUpdatePattern: (updates: Partial<RecurringMilestone>) => Promise<void>;
  onDelete: () => void;
}

/**
 * Pure UI component for displaying and editing a recurring milestone
 * Handles pattern editing (daily/weekly/monthly) and load editing
 */
export function RecurringMilestoneCard({
  recurringMilestone,
  projectEstimatedHours,
  projectContinuous,
  projectStartDate,
  onUpdateLoad,
  onUpdatePattern,
  onDelete
}: RecurringMilestoneCardProps) {
  const [editingRecurringLoad, setEditingRecurringLoad] = useState(false);
  const [editingLoadValue, setEditingLoadValue] = useState(0);
  const [editingRecurringPattern, setEditingRecurringPattern] = useState(false);
  
  // Pattern editing state
  const [editingRecurringType, setEditingRecurringType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [editingRecurringInterval, setEditingRecurringInterval] = useState(1);
  const [editingWeeklyDayOfWeek, setEditingWeeklyDayOfWeek] = useState<number>(1);
  const [editingMonthlyPattern, setEditingMonthlyPattern] = useState<'date' | 'dayOfWeek'>('date');
  const [editingMonthlyDate, setEditingMonthlyDate] = useState<number>(1);
  const [editingMonthlyWeekOfMonth, setEditingMonthlyWeekOfMonth] = useState<number>(1);
  const [editingMonthlyDayOfWeek, setEditingMonthlyDayOfWeek] = useState<number>(1);

  const handleStartLoadEdit = () => {
    setEditingRecurringLoad(true);
    setEditingLoadValue(recurringMilestone.timeAllocation);
  };

  const handleSaveLoad = async () => {
    await onUpdateLoad(editingLoadValue);
    setEditingRecurringLoad(false);
  };

  const handleStartPatternEdit = () => {
    setEditingRecurringPattern(true);
    setEditingRecurringType(recurringMilestone.recurringType);
    setEditingRecurringInterval(recurringMilestone.recurringInterval);
    setEditingWeeklyDayOfWeek(recurringMilestone.weeklyDayOfWeek ?? projectStartDate.getDay());
    setEditingMonthlyPattern(recurringMilestone.monthlyPattern ?? 'date');
    setEditingMonthlyDate(recurringMilestone.monthlyDate ?? projectStartDate.getDate());
    setEditingMonthlyWeekOfMonth(recurringMilestone.monthlyWeekOfMonth ?? 1);
    setEditingMonthlyDayOfWeek(recurringMilestone.monthlyDayOfWeek ?? projectStartDate.getDay());
  };

  const handleSavePattern = async () => {
    await onUpdatePattern({
      recurringType: editingRecurringType,
      recurringInterval: editingRecurringInterval,
      weeklyDayOfWeek: editingWeeklyDayOfWeek,
      monthlyPattern: editingMonthlyPattern,
      monthlyDate: editingMonthlyDate,
      monthlyWeekOfMonth: editingMonthlyWeekOfMonth,
      monthlyDayOfWeek: editingMonthlyDayOfWeek
    });
    setEditingRecurringPattern(false);
  };

  const getPatternDisplay = () => {
    if (recurringMilestone.recurringType === 'weekly') {
      return `Every ${getDayName(recurringMilestone.weeklyDayOfWeek ?? projectStartDate.getDay())}`;
    } else if (recurringMilestone.recurringType === 'monthly') {
      if (recurringMilestone.monthlyPattern === 'date') {
        return `${getOrdinalNumber(recurringMilestone.monthlyDate ?? projectStartDate.getDate())} of each month`;
      } else {
        return `${getWeekOfMonthName(recurringMilestone.monthlyWeekOfMonth ?? 1)} ${getDayName(recurringMilestone.monthlyDayOfWeek ?? projectStartDate.getDay())} of each month`;
      }
    }
    return 'Daily';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3">
      <div className="flex items-end justify-between">
        {/* Left side: Name and Budget */}
        <div className="flex items-end gap-3">
          {/* Name (read-only with icon) */}
          <div className="min-w-[120px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
            <div className="h-9 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">{recurringMilestone.name}</span>
            </div>
          </div>

          {/* Budget Field (editable) */}
          <div className="min-w-[80px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Time Budget</Label>
            <div className="flex items-center gap-1">
              {editingRecurringLoad ? (
                <Input
                  type="number"
                  value={editingLoadValue}
                  onChange={(e) => setEditingLoadValue(Number(e.target.value))}
                  className="h-9 text-sm border-border bg-background w-20"
                  min="0"
                  step="0.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveLoad();
                    } else if (e.key === 'Escape') {
                      setEditingRecurringLoad(false);
                    }
                  }}
                  onBlur={() => {
                    if (editingLoadValue !== recurringMilestone.timeAllocation) {
                      handleSaveLoad();
                    } else {
                      setEditingRecurringLoad(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <Button
                  variant="outline"
                  className="h-9 text-sm justify-start text-left font-normal px-3"
                  style={{ width: `${Math.max(`${recurringMilestone.timeAllocation}h`.length * 8 + 40, 80)}px` }}
                  onClick={handleStartLoadEdit}
                >
                  {recurringMilestone.timeAllocation}h
                </Button>
              )}
              {!projectContinuous && (
                <span className="text-xs text-muted-foreground/60">of {projectEstimatedHours}h</span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Pattern and Delete Button */}
        <div className="flex items-end gap-3">
          {/* Pattern Field */}
          <div className="min-w-[180px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Pattern</Label>
            {editingRecurringPattern ? (
              <div className="space-y-2">
                <Select 
                  value={editingRecurringType} 
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setEditingRecurringType(value)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>

                {/* Weekly day selection */}
                {editingRecurringType === 'weekly' && (
                  <Select 
                    value={editingWeeklyDayOfWeek.toString()} 
                    onValueChange={(value) => setEditingWeeklyDayOfWeek(parseInt(value))}
                  >
                    <SelectTrigger className="w-full h-9">
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
                )}

                {/* Monthly pattern selection */}
                {editingRecurringType === 'monthly' && (
                  <div className="space-y-2">
                    <Select 
                      value={editingMonthlyPattern} 
                      onValueChange={(value: 'date' | 'dayOfWeek') => setEditingMonthlyPattern(value)}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Specific date</SelectItem>
                        <SelectItem value="dayOfWeek">Day of week pattern</SelectItem>
                      </SelectContent>
                    </Select>

                    {editingMonthlyPattern === 'date' ? (
                      <Select 
                        value={editingMonthlyDate.toString()} 
                        onValueChange={(value) => setEditingMonthlyDate(parseInt(value))}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                            <SelectItem key={date} value={date.toString()}>
                              {getOrdinalNumber(date)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-1">
                        <Select 
                          value={editingMonthlyWeekOfMonth.toString()} 
                          onValueChange={(value) => setEditingMonthlyWeekOfMonth(parseInt(value))}
                        >
                          <SelectTrigger className="w-full h-9">
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
                        <Select 
                          value={editingMonthlyDayOfWeek.toString()} 
                          onValueChange={(value) => setEditingMonthlyDayOfWeek(parseInt(value))}
                        >
                          <SelectTrigger className="w-full h-9">
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
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePattern}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingRecurringPattern(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="h-9 text-sm justify-start text-left font-normal px-3 w-full"
                onClick={handleStartPatternEdit}
              >
                {getPatternDisplay()}
              </Button>
            )}
          </div>

          {/* Delete Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recurring Milestones</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the recurring milestone pattern? This will remove the configuration and any generated milestones. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Recurring Milestones
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {projectContinuous
            ? 'Milestones are generated automatically as needed'
            : 'Based on project timeline and recurrence pattern'}
        </p>
      </div>
    </div>
  );
}
