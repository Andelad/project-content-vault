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

interface RecurringUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateThis: () => void;
  onUpdateFuture: () => void;
  onUpdateAll: () => void;
  eventTitle: string;
  isRecurring: boolean;
}

export function RecurringUpdateDialog({
  isOpen,
  onClose,
  onUpdateThis,
  onUpdateFuture,
  onUpdateAll,
  eventTitle,
  isRecurring
}: RecurringUpdateDialogProps) {
  if (!isRecurring) {
    // For non-recurring events, just update directly
    onUpdateThis();
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Recurring Event</AlertDialogTitle>
          <AlertDialogDescription>
            "{eventTitle}" is part of a recurring series. What would you like to update?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col space-y-2 sm:space-y-2 sm:space-x-0">
          <div className="flex flex-col w-full space-y-2">
            <Button 
              onClick={onUpdateThis}
              variant="outline"
              className="w-full justify-start"
            >
              Just this event
            </Button>
            <Button 
              onClick={onUpdateFuture}
              variant="outline"
              className="w-full justify-start"
            >
              This and future events
            </Button>
            <Button 
              onClick={onUpdateAll}
              variant="outline"
              className="w-full justify-start"
            >
              All events in series
            </Button>
          </div>
          <AlertDialogCancel onClick={onClose} className="w-full mt-4">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
