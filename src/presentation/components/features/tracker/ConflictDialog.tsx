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
import { Clock, StopCircle } from 'lucide-react';
import type { TimeTrackingState } from '@/shared/types/timeTracking';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession: TimeTrackingState;
  onStopAndStart: () => void;
}

export function ConflictDialog({ 
  isOpen, 
  onClose, 
  activeSession, 
  onStopAndStart
}: ConflictDialogProps) {
  const projectName = activeSession.selectedProject?.name || activeSession.searchQuery || 'Unknown Project';
  const elapsed = activeSession.startTime 
    ? Math.floor((Date.now() - activeSession.startTime.getTime()) / 1000)
    : 0;
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" />
            Active Tracking Session Detected
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You already have an active time tracking session running in another window or tab:
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">{projectName}</p>
              <p className="text-sm text-muted-foreground">
                Running for {hours}h {minutes}m
              </p>
            </div>
            <p className="text-sm">
              You can only track time for one project at a time. What would you like to do?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onStopAndStart}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            Stop & Start New
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
