/**
 * HabitEventContent
 * 
 * Renders habit events in the planner calendar.
 * Shows croissant icon, title, and time range (adaptive based on height).
 */

import { formatTimeForValidation } from '@/presentation/utils/timeCalculations';;
import { Croissant } from 'lucide-react';

interface HabitEventContentProps {
  title: string;
  start: Date;
  end: Date;
  isCompactView: boolean;
}

export function HabitEventContent({ title, start, end, isCompactView }: HabitEventContentProps) {
  const startTime = formatTimeForValidation(start);
  const endTime = formatTimeForValidation(end);

  // Calculate height for adaptive layout
  const durationInMs = end.getTime() - start.getTime();
  const durationInMinutes = durationInMs / (1000 * 60);
  const approximateHeight = isCompactView 
    ? (durationInMinutes / 30) * 15  // Compact: 15px per 30-minute slot
    : (durationInMinutes / 15) * 21; // Expanded: 21px per 15-minute slot
  
  const showTwoLines = approximateHeight >= 32;

  if (showTwoLines) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Croissant size={14} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: '10px', opacity: 0.8, lineHeight: 1 }}>
          {startTime} - {endTime}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Croissant size={14} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {title}
        </div>
      </div>
    </div>
  );
}
