import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog';
import { Button } from '@/components/shadcn/button';

interface WorkHourScopeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onThisDay: () => void;
  onAllFuture: () => void;
  action: 'update' | 'delete' | 'add';
  workHourDate?: string; // Formatted date string for display
}

export function WorkHourScopeDialog({
  isOpen,
  onClose,
  onThisDay,
  onAllFuture,
  action,
  workHourDate
}: WorkHourScopeDialogProps) {
  const actionText = action === 'delete' ? 'delete' : action === 'add' ? 'add' : 'update';
  const actionTextCapitalized = actionText.charAt(0).toUpperCase() + actionText.slice(1);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionTextCapitalized} Work Hours</AlertDialogTitle>
          <AlertDialogDescription>
            This work hour is part of your recurring weekly schedule. What would you like to {actionText}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col space-y-2 sm:space-y-2 sm:space-x-0">
          <div className="flex flex-col w-full space-y-2">
            <Button 
              onClick={onThisDay}
              variant="outline"
              className="w-full justify-start"
            >
              Just this day{workHourDate ? ` (${workHourDate})` : ''}
            </Button>
            <Button 
              onClick={onAllFuture}
              variant="outline"
              className="w-full justify-start"
            >
              All future days
            </Button>
            {action === 'delete' && (
              <p className="text-xs text-gray-500 px-3 pt-2">
                Note: To delete all occurrences, please go to Settings → Work Hours
              </p>
            )}
          </div>
          <AlertDialogCancel onClick={onClose} className="w-full mt-4">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
