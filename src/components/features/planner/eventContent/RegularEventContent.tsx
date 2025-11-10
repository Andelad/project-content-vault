/**
 * RegularEventContent
 * 
 * Renders regular (tracked/manual) events in the planner calendar.
 * Adaptive layout: shows time, description, and project based on available height.
 */

import { formatTimeForValidation } from '@/services';

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

  // Create the icon HTML
  let iconHtml = '';
  if (isCurrentlyTracking) {
    iconHtml = '<div style="width: 8px; height: 8px; border-radius: 50%; background-color: #ef4444; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;" title="Currently recording"></div>';
  } else {
    const checkIconSvg = completed 
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m9 12 2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle></svg>';
    iconHtml = `<button type="button" style="cursor: pointer; transition: transform 0.2s; background: none; border: none; color: inherit; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;" 
                  onmouseover="this.style.transform='scale(1.1)'" 
                  onmouseout="this.style.transform='scale(1)'"
                  onclick="event.stopPropagation(); window.plannerToggleCompletion && window.plannerToggleCompletion('${eventId}')"
                  title="${completed ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;
  }

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
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
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
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
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
          <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0, marginLeft: '4px' }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
        </div>
      </div>
    );
  }

  // Fallback for very small events - just icon
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'inherit' }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
      </div>
    </div>
  );
}
