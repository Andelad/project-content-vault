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
} from '@/presentation/components/shadcn/alert-dialog';
import { Button } from '@/presentation/components/shadcn/button';

interface RecurringDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteThis: () => void;
  onDeleteFuture: () => void;
  onDeleteAll: () => void;
  eventTitle: string;
  isRecurring: boolean;
}

export function RecurringDeleteDialog({
  isOpen,
  onClose,
  onDeleteThis,
  onDeleteFuture,
  onDeleteAll,
  eventTitle,
  isRecurring
}: RecurringDeleteDialogProps) {
  if (!isRecurring) {
    // For non-recurring events, show simple confirmation
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteThis} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // For recurring events, show options
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recurring Event</AlertDialogTitle>
          <AlertDialogDescription>
            This is part of a recurring series. What would you like to delete?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            onClick={onDeleteThis}
            className="justify-start h-auto p-4 border-2 hover:border-destructive hover:bg-destructive/5"
          >
            <div className="text-left">
              <div className="font-medium">Just this event</div>
              <div className="text-sm text-muted-foreground">Delete only this occurrence</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            onClick={onDeleteFuture}
            className="justify-start h-auto p-4 border-2 hover:border-destructive hover:bg-destructive/5"
          >
            <div className="text-left">
              <div className="font-medium">This and future events</div>
              <div className="text-sm text-muted-foreground">Delete this occurrence and all future occurrences</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            onClick={onDeleteAll}
            className="justify-start h-auto p-4 border-2 hover:border-destructive hover:bg-destructive/5"
          >
            <div className="text-left">
              <div className="font-medium">All events in series</div>
              <div className="text-sm text-muted-foreground">Delete all occurrences of this recurring event</div>
            </div>
          </Button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
