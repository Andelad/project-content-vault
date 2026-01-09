/**
 * WorkHourEventContent
 * 
 * Renders work hour slots in the planner calendar.
 * Displays in italic grey with time range.
 */

import { formatTimeForValidation } from '@/presentation/utils/timeCalculations';;
import { NEUTRAL_COLORS } from '@/presentation/constants/colors';

interface WorkHourEventContentProps {
  title: string;
  start: Date;
  end: Date;
}

export function WorkHourEventContent({ title, start, end }: WorkHourEventContentProps) {
  const startTime = formatTimeForValidation(start);
  const endTime = formatTimeForValidation(end);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '4px 6px', overflow: 'hidden' }}>
      <div style={{ 
        fontSize: '11px', 
        fontStyle: 'italic', 
        color: NEUTRAL_COLORS.gray500, 
        fontWeight: 500, 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis' 
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '10px', 
        color: NEUTRAL_COLORS.gray500, 
        opacity: 0.8, 
        marginTop: '2px' 
      }}>
        {startTime} - {endTime}
      </div>
    </div>
  );
}
