import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Clock, Calendar, Settings, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface WorkHourChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeType: 'modify' | 'new' | null;
  workHourInfo: {
    day: string;
    startTime: string;
    endTime: string;
    duration: number;
  } | null;
  onConfirm: (scope: 'just-this' | 'all-future' | 'permanent') => void;
  hasOverlaps?: boolean;
  overlapWarning?: string;
}

export function WorkHourChangeModal({
  isOpen,
  onClose,
  changeType,
  workHourInfo,
  onConfirm,
  hasOverlaps,
  overlapWarning
}: WorkHourChangeModalProps) {
  if (!workHourInfo) return null;

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration);
    const minutes = Math.round((duration - hours) * 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const handleConfirm = (scope: 'just-this' | 'all-future' | 'permanent') => {
    onConfirm(scope);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full mx-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <span className="break-words">{changeType === 'new' ? 'Add Work Hours' : 'Modify Work Hours'}</span>
          </DialogTitle>
          <DialogDescription className="break-words">
            {changeType === 'new' 
              ? 'You are adding new work hours. How would you like to apply this change?'
              : 'You are modifying existing work hours. How would you like to apply this change?'
            }
          </DialogDescription>
        </DialogHeader>

        {hasOverlaps && (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-sm break-words leading-relaxed">{overlapWarning}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="py-4">
          {/* Work hour details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="font-medium capitalize break-words">{workHourInfo.day}</span>
              <span className="text-sm text-gray-500 flex-shrink-0">{formatDuration(workHourInfo.duration)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="break-words">{formatTime(workHourInfo.startTime)} - {formatTime(workHourInfo.endTime)}</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto p-4 min-h-[4rem]"
              onClick={() => handleConfirm('just-this')}
            >
              <div className="flex items-start gap-3 w-full">
                <Calendar className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium mb-1">Just this {workHourInfo.day.toLowerCase()}</div>
                  <div className="text-sm text-gray-500 leading-relaxed break-words">
                    {changeType === 'new' 
                      ? 'Add work hours only for this specific day'
                      : 'Change work hours only for this specific day'
                    }
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto p-4 min-h-[4rem]"
              onClick={() => handleConfirm(changeType === 'new' ? 'permanent' : 'all-future')}
            >
              <div className="flex items-start gap-3 w-full">
                <Settings className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium mb-1 break-words">
                    {changeType === 'new' 
                      ? `Make this a permanent ${workHourInfo.day.toLowerCase()} slot`
                      : `All future ${workHourInfo.day.toLowerCase()}s`
                    }
                  </div>
                  <div className="text-sm text-gray-500 leading-relaxed break-words">
                    {changeType === 'new' 
                      ? 'Add this time slot to your weekly work hours in settings'
                      : 'Update your weekly work hours settings and apply to all future weeks'
                    }
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-shrink-0">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}