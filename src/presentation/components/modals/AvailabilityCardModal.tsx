import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn/dialog';
import { TabComponent } from '../shared/TabComponent';
import { NEUTRAL_COLORS } from '@/presentation/app/constants/colors';

interface AvailabilityCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'timeline' | 'planner';
}

export function AvailabilityCardModal({ open, onOpenChange, initialTab = 'timeline' }: AvailabilityCardModalProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'planner'>(initialTab);

  // Update active tab when modal opens with initialTab
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Availability Card Settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div 
          className="flex items-end border-b border-gray-200 -mx-6 px-6"
          style={{ backgroundColor: NEUTRAL_COLORS.gray25 }}
        >
          <TabComponent
            label="Timeline View"
            value="timeline"
            isActive={activeTab === 'timeline'}
            onClick={() => setActiveTab('timeline')}
          />
          <TabComponent
            label="Planner View"
            value="planner"
            isActive={activeTab === 'planner'}
            onClick={() => setActiveTab('planner')}
          />
          <div className="flex-1 border-b border-gray-200" style={{ marginBottom: '-1px' }} />
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Timeline View Settings</h3>
              <p className="text-sm text-gray-600">
                Settings for the availability card in the Timeline view will appear here.
              </p>
              {/* Placeholder for future settings */}
            </div>
          )}

          {activeTab === 'planner' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Planner View Settings</h3>
              <p className="text-sm text-gray-600">
                Settings for the availability card in the Planner view will appear here.
              </p>
              {/* Placeholder for future settings */}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
