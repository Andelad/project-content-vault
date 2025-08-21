import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle, Calendar, Settings } from 'lucide-react';

interface WorkHourScopeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: 'this-week' | 'permanent') => void;
  changeType: 'update' | 'delete' | 'add';
  isFromSettings: boolean;
}

export function WorkHourScopeDialog({
  isOpen,
  onClose,
  onConfirm,
  changeType,
  isFromSettings,
}: WorkHourScopeDialogProps) {
  const actionText = changeType === 'delete' ? 'delete' : 
                    changeType === 'add' ? 'add' : 'modify';
  const actionPastTense = changeType === 'delete' ? 'deleted' : 
                         changeType === 'add' ? 'added' : 'modified';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {changeType === 'delete' ? 'Delete' : 
             changeType === 'add' ? 'Add' : 'Modify'} Work Hours
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            {changeType === 'add' 
              ? "How would you like to add this work hour?"
              : `You're about to ${actionText} work hours that come from your default schedule. How would you like to apply this change?`
            }
          </p>
          
          <div className="space-y-3">
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">This Week Only</span>
              </div>
              <p className="text-xs text-blue-700">
                Work hours will be {actionPastTense} just for this week. 
                {changeType === 'add' 
                  ? "This won't affect your default schedule."
                  : "Your default schedule in settings stays unchanged."
                }
              </p>
            </div>
            
            <div className="border rounded-lg p-3 bg-purple-50">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-900">
                  {changeType === 'add' ? 'Add to Default Schedule' : 'Permanently'}
                </span>
              </div>
              <p className="text-xs text-purple-700">
                {changeType === 'add'
                  ? "Add this work hour to your default schedule. It will appear every week on this day."
                  : "Your default schedule in settings will be updated. This affects all future weeks."
                }
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="default"
            onClick={() => onConfirm('this-week')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Calendar className="w-4 h-4 mr-1" />
            This Week Only
          </Button>
          <Button 
            variant="default"
            onClick={() => onConfirm('permanent')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Settings className="w-4 h-4 mr-1" />
            Update Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
