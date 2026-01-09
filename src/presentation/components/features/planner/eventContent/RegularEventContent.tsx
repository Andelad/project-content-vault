/**
 * RegularEventContent
 * 
 * Renders regular (tracked/manual) events in the planner calendar.
 * Adaptive layout: shows time, description, and project based on available height.
 */

import { formatTimeForValidation } from '@/presentation/utils/timeCalculations';;
import { Check, Circle, CircleCheck } from 'lucide-react';

interface RegularEventContentProps {
  eventId: string;
  title: string;
  start: Date;
  end: Date;
  projectName?: string;
  clientName?: string;
  completed: boolean;
  isCurrentlyTracking: boolean;
  isCompactView: boolean;
}

// Extend window type for global handler
declare global {
  interface Window {
    plannerToggleCompletion?: (eventId: string) => void;
  }
}

export function RegularEventContent({ 
  eventId, 
  title, 
  start, 
  end, 
  projectName, 
  clientName,
  completed, 
  isCurrentlyTracking,
  isCompactView 
}: RegularEventContentProps) {
  const startTime = formatTimeForValidation(start);
  const endTime = formatTimeForValidation(end);
  
  // Create project/client line
  const projectLine = projectName 
    ? `${projectName}${clientName ? ` • ${clientName}` : ''}`
    : 'No Project';

  // Handle completion toggle safely
  const handleToggleCompletion = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.plannerToggleCompletion?.(eventId);
  };

  // Render icon component safely (no dangerouslySetInnerHTML)
  const renderIcon = () => {
    if (isCurrentlyTracking) {
      return (
        <div 
          style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            backgroundColor: '#ef4444', 
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
          }} 
          title="Currently recording"
        />
      );
    }

    return (
      <button
        type="button"
        onClick={handleToggleCompletion}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title={completed ? 'Mark as not completed' : 'Mark as completed'}
        style={{ 
          cursor: 'pointer', 
          transition: 'transform 0.2s', 
          background: 'none', 
          border: 'none', 
          color: 'inherit', 
          padding: 0, 
          margin: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        {completed ? (
          <CircleCheck size={12} />
        ) : (
          <Circle size={12} />
        )}
      </button>
    );
  };

  // Calculate approximate event height
  const durationInMs = end.getTime() - start.getTime();
  const durationInMinutes = durationInMs / (1000 * 60);
  const approximateHeight = isCompactView 
    ? (durationInMinutes / 30) * 15  // Compact: 15px per 30-minute slot
    : (durationInMinutes / 15) * 21; // Expanded: 21px per 15-minute slot

  const showOneLine = approximateHeight >= 18;
  const showTwoLines = approximateHeight >= 32;
  const showThreeLines = approximateHeight >= 45;

  if (showThreeLines) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {startTime} - {endTime}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }}>
            {renderIcon()}
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.75, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {projectLine}
        </div>
      </div>
    );
  }

  if (showTwoLines) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {startTime} - {endTime}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }}>
            {renderIcon()}
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
      </div>
    );
  }

  if (showOneLine) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0, marginLeft: '4px' }}>
            {renderIcon()}
          </div>
        </div>
      </div>
    );
  }

  // Fallback for very small events - just icon
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>
          {renderIcon()}
        </div>
      </div>
    </div>
  );
}
