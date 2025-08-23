import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {changeType === 'delete' ? 'Delete' : 
             changeType === 'add' ? 'Add' : 'Modify'} Work Hours
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-sm text-gray-600 mb-6 text-center">
            How would you like to {actionText} this work hour?
          </p>
        </div>
        
        <DialogFooter className="flex gap-3 justify-center">
          <Button 
            variant="outline"
            onClick={() => onConfirm('this-week')}
            className="flex-1"
          >
            This week only
          </Button>
          <Button 
            variant="default"
            onClick={() => onConfirm('permanent')}
            className="flex-1"
          >
            All future events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
