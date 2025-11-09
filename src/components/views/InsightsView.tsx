import React, { useState } from 'react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { HelpModal } from '../modals/HelpModal';
import { 
  TimeDistributionCard,
  AvailabilityUsedCard,
  FutureCommitmentsCard,
  AverageDayHeatmapCard
} from '@/components/features/insights';

export function InsightsView() {
  const { projects, groups } = useProjectContext();
  const { events } = usePlannerContext();
  const { settings } = useSettingsContext();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalInitialTopic, setHelpModalInitialTopic] = useState<string | undefined>();

  // Early return if essential data is not loaded
  if (!projects || !events || !settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-auto light-scrollbar">
        <div className="p-[21px] space-y-[21px]">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Time Distribution Chart */}
            <TimeDistributionCard
              events={events}
              projects={projects}
              onHelpClick={() => {
                setHelpModalInitialTopic('insights-time-distribution');
                setHelpModalOpen(true);
              }}
            />

            {/* Availability Used Chart */}
            <AvailabilityUsedCard
              projects={projects}
              events={events}
              weeklyWorkHours={settings.weeklyWorkHours}
              onHelpClick={() => {
                setHelpModalInitialTopic('insights-availability-used');
                setHelpModalOpen(true);
              }}
            />
          </div>

          {/* Average Day Heatmap and Future Commitments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[21px]">
            {/* Average Day Heatmap Card */}
            <div className="lg:col-span-2">
              <AverageDayHeatmapCard 
                events={events}
                groups={groups || []}
                projects={projects || []}
                onHelpClick={() => {
                  setHelpModalInitialTopic('insights-average-day');
                  setHelpModalOpen(true);
                }}
              />
            </div>

            {/* Future Commitments Card */}
            <FutureCommitmentsCard
              projects={projects}
              onHelpClick={() => {
                setHelpModalInitialTopic('insights-future-commitments');
                setHelpModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>
      
      <HelpModal 
        open={helpModalOpen} 
        onOpenChange={setHelpModalOpen} 
        initialTopicId={helpModalInitialTopic}
      />
    </div>
  );
}

export default InsightsView;
