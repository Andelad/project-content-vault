import React, { useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/shadcn/input';
import { Button } from '@/components/shadcn/button';
import { Label } from '@/components/shadcn/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/shadcn/alert-dialog';
import { getDayName, getOrdinalNumber, getWeekOfMonthName } from '@/presentation/app/utils/dateFormatUtils';
import type { RecurringPhase } from '@/hooks/phase';

interface RecurringPhaseCardProps {
  recurringMilestone: RecurringPhase;
  projectEstimatedHours: number;
  projectContinuous: boolean;
  projectStartDate: Date;
  onUpdateLoad: (newLoad: number) => Promise<void>;
  onEditPattern: () => void;
  onDelete: () => void;
}

/**
 * Pure UI component for displaying and editing a recurring phase template
 * Handles pattern editing (daily/weekly/monthly) and load editing
 * Note: Database still uses RecurringPhase type for backward compatibility
 */
export function RecurringPhaseCard({
  recurringMilestone,
  projectEstimatedHours,
  projectContinuous,
  projectStartDate,
  onUpdateLoad,
  onEditPattern,
  onDelete
}: RecurringPhaseCardProps) {
  const [editingRecurringLoad, setEditingRecurringLoad] = useState(false);
  const [editingLoadValue, setEditingLoadValue] = useState(0);

  const handleStartLoadEdit = () => {
    setEditingRecurringLoad(true);
    setEditingLoadValue(recurringMilestone.timeAllocation);
  };

  const handleSaveLoad = async () => {
    await onUpdateLoad(editingLoadValue);
    setEditingRecurringLoad(false);
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
            <Label className="text-xs text-muted-foreground mb-1 block">Estimate (hrs)</Label>
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
            <Button
              variant="outline"
              className="h-9 text-sm justify-start text-left font-normal px-3 w-full"
              onClick={onEditPattern}
            >
              {getPatternDisplay()}
            </Button>
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
                <AlertDialogTitle>Delete Recurring Phases</AlertDialogTitle>
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
                  Delete Recurring Phases
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
