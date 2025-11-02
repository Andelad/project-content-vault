import React, { memo, useState } from 'react';
import { Info, Circle, Hash } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { UnifiedAvailabilityCircles } from './UnifiedAvailabilityCircles';
import { WorkloadGraph } from './WorkloadGraph';
import { Card } from '../ui/card';
import { NEUTRAL_COLORS } from '@/constants/colors';

interface TabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ChromeTab = ({ label, isActive, onClick }: TabProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 py-2.5 text-sm font-medium transition-all duration-200
        ${isActive 
          ? 'text-gray-800 z-10' 
          : 'text-gray-500 hover:text-gray-600 z-0'
        }
      `}
      style={{
        backgroundColor: isActive ? 'white' : NEUTRAL_COLORS.gray200,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        marginRight: '-2px',
        paddingBottom: isActive ? '13px' : '10px',
        borderTop: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderLeft: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderRight: isActive ? `1px solid ${NEUTRAL_COLORS.gray200}` : '1px solid transparent',
        borderBottom: isActive ? '1px solid white' : 'none',
        marginBottom: isActive ? '-1px' : '0',
      }}
    >
      {label}
      {/* Chrome-style curves at bottom corners of active tab */}
      {isActive && (
        <>
          {/* Left curve */}
          <div
            className="absolute -left-2 bottom-0 w-2 h-2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 0 0, transparent 8px, white 8px)',
            }}
          />
          {/* Right curve */}
          <div
            className="absolute -right-2 bottom-0 w-2 h-2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 100% 0, transparent 8px, white 8px)',
            }}
          />
        </>
      )}
    </button>
  );
};

interface InfoButtonProps {
  title: string;
  description: string;
}

const InfoButton = ({ title, description }: InfoButtonProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 hover:bg-gray-50 text-gray-400 hover:text-gray-500"
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="top">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface TabbedAvailabilityCardProps {
  collapsed: boolean;
  dates: Date[];
  projects: any[];
  settings: any;
  mode: 'days' | 'weeks';
  availabilityDisplayMode: 'circles' | 'numbers';
  onDisplayModeChange: (mode: 'circles' | 'numbers') => void;
  columnMarkersOverlay?: React.ReactNode;
  context?: 'timeline' | 'planner';
  timeGutterWidth?: number;
  scrollbarWidth?: number;
}

export const TabbedAvailabilityCard = memo(function TabbedAvailabilityCard({
  collapsed,
  dates,
  projects,
  settings,
  mode,
  availabilityDisplayMode,
  onDisplayModeChange,
  columnMarkersOverlay,
  context = 'timeline',
  timeGutterWidth = 0,
  scrollbarWidth = 0
}: TabbedAvailabilityCardProps) {
  const [activeTab, setActiveTab] = useState<'circles' | 'time-spent' | 'availability'>('availability');
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);

  const circlesRows = [
    {
      type: 'available' as const,
      label: 'Work Hours',
      color: 'bg-green-500',
      description: 'The number of work hours remaining after subtracting allocated project time.'
    },
    {
      type: 'busy' as const,
      label: 'Overcommitted',
      color: 'bg-red-500',
      description: 'Time allocated over the total number of available work hours.'
    }
  ];

  const timeSpentRows = [
    {
      type: 'total-planned' as const,
      label: 'Total Project Time',
      color: 'bg-gray-500',
      description: 'The number of planned project events in total.'
    },
    {
      type: 'other-time' as const,
      label: 'Other Time',
      color: 'bg-gray-300',
      description: 'Events planned that are not linked to a project.'
    }
  ];

  const currentRows = activeTab === 'circles' ? circlesRows : activeTab === 'time-spent' ? timeSpentRows : null;
  const isGraphTab = activeTab === 'availability';

  return (
    <div className="relative">
      {/* Tabs Container */}
      <div 
        className="flex items-end border-b border-gray-200"
        style={{
          backgroundColor: 'rgb(249, 250, 251)', // bg-gray-50 to match page background
          paddingTop: '4px',
        }}
      >
        <ChromeTab
          label="Availability"
          isActive={activeTab === 'availability'}
          onClick={() => setActiveTab('availability')}
        />
        <ChromeTab
          label="Time Spent"
          isActive={activeTab === 'time-spent'}
          onClick={() => setActiveTab('time-spent')}
        />
        {/* Fill remaining space with background */}
        <div className="flex-1 border-b border-gray-200" style={{ marginBottom: '-1px' }} />
      </div>

      {/* Card Content */}
      <Card className="overflow-hidden shadow-sm border-x border-b border-t-0 border-gray-200 rounded-t-none relative bg-gray-50">
        {/* Column Markers Overlay - positioned inside card */}
        {columnMarkersOverlay && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {columnMarkersOverlay}
          </div>
        )}
        
        {context === 'planner' ? (
          /* Planner Layout - flex columns with time gutter */
          <div className="flex h-full">
            {/* Time gutter */}
            <div 
              className="flex-shrink-0 border-r border-gray-100 bg-gray-50"
              style={{ width: `${timeGutterWidth}px` }}
            />
            
            {/* Content area - grows to fill space */}
            <div className="flex-1 flex flex-col relative">
              {isGraphTab ? (
                /* Graph tab content */
                <div className="rounded-t-lg overflow-hidden" style={{ height: '104px' }}>
                  <WorkloadGraph
                    dates={dates}
                    projects={projects}
                    settings={settings}
                    mode={mode}
                    context={context}
                    hoveredColumnIndex={hoveredColumnIndex}
                    onColumnHover={setHoveredColumnIndex}
                  />
                </div>
              ) : (
                /* Regular tabs content - time spent with numbers */
                currentRows && currentRows.map((row, index) => (
                  <div 
                    key={row.type}
                    className={`${
                      index < currentRows.length - 1 ? 'border-b border-gray-100' : ''
                    } ${index === 0 ? 'rounded-t-lg overflow-hidden' : ''}`}
                    style={{ height: '52px' }}
                  >
                    <UnifiedAvailabilityCircles
                      dates={dates}
                      projects={row.type === 'available' || row.type === 'busy' ? projects : undefined}
                      settings={settings}
                      type={row.type}
                      mode={mode}
                      displayMode="numbers"
                      context={context}
                      hoveredColumnIndex={hoveredColumnIndex}
                      onColumnHover={setHoveredColumnIndex}
                    />
                  </div>
                ))
              )}
            </div>
            
            {/* Scrollbar spacer */}
            {scrollbarWidth > 0 && (
              <div 
                className="flex-shrink-0 bg-gray-50" 
                style={{ width: `${scrollbarWidth}px` }}
              />
            )}
          </div>
        ) : (
          /* Timeline Layout - fixed width columns */
          <div 
            className="flex-1 flex flex-col bg-gray-50 relative availability-timeline-content" 
            style={{ 
              minWidth: mode === 'weeks'
                ? `${dates.length * 77}px`
                : `${dates.length * 52 + 52}px`, // Match timeline column width: 52px per day + buffer (unchanged)
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            {isGraphTab ? (
              /* Graph tab content */
              <div className="rounded-t-lg overflow-hidden" style={{ height: '104px' }}>
                <WorkloadGraph
                  dates={dates}
                  projects={projects}
                  settings={settings}
                  mode={mode}
                  context={context}
                  hoveredColumnIndex={hoveredColumnIndex}
                  onColumnHover={setHoveredColumnIndex}
                />
              </div>
            ) : (
              /* Regular tabs content - time spent with numbers */
              currentRows && currentRows.map((row, index) => (
                <div 
                  key={row.type}
                  className={`${
                    index < currentRows.length - 1 ? 'border-b border-gray-100' : ''
                  } ${index === 0 ? 'rounded-t-lg overflow-hidden' : ''}`}
                  style={{ height: '52px' }}
                >
                  <UnifiedAvailabilityCircles
                    dates={dates}
                    projects={row.type === 'available' || row.type === 'busy' ? projects : undefined}
                    settings={settings}
                    type={row.type}
                    mode={mode}
                    displayMode="numbers"
                    context={context}
                    hoveredColumnIndex={hoveredColumnIndex}
                    onColumnHover={setHoveredColumnIndex}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
});
