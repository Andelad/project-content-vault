import React, { useState } from 'react';
import { useProjectContext } from '@/presentation/contexts/ProjectContext';
import { useEvents } from '@/presentation/hooks/data/useEvents';
import { useSettingsContext } from '@/presentation/contexts/SettingsContext';
import { HelpModal } from '../modals/HelpModal';
import { 
  TimeDistributionCard,
  AvailabilityUsedCard,
  FutureCommitmentsCard,
  AverageDayHeatmapCard
} from '@/presentation/components/features/insights';
import type { CalendarEvent } from '@/shared/types/core';

export function InsightsView() {
  const { projects, groups } = useProjectContext();
  const { events: rawEvents } = useEvents();
  const { settings } = useSettingsContext();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalInitialTopic, setHelpModalInitialTopic] = useState<string | undefined>();

  // Transform raw database events to UI format
  const events: CalendarEvent[] = rawEvents.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    startTime: new Date(e.start_time),
    endTime: new Date(e.end_time),
    projectId: e.project_id || undefined,
    color: e.color || '',
    completed: e.completed ?? false,
    duration: e.duration,
    category: (e.category || 'event') as 'event' | 'habit' | 'task',
    type: (e.event_type || 'planned') as 'planned' | 'tracked' | 'completed',
    recurringGroupId: e.recurring_group_id || undefined
  }));

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
