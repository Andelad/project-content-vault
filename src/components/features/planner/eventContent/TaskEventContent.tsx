/**
 * TaskEventContent
 * 
 * Renders task events in the planner calendar.
 * Shows completion checkbox and title (no time display).
 */

interface TaskEventContentProps {
  eventId: string;
  title: string;
  completed: boolean;
  onToggleCompletion: (eventId: string) => void;
}

export function TaskEventContent({ eventId, title, completed }: TaskEventContentProps) {
  // Checkbox SVG based on completion status
  const checkIconSvg = completed 
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m9 11 3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>';
  
  const iconHtml = `<button type="button" style="cursor: pointer; transition: transform 0.2s; background: none; border: none; color: inherit; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;" 
                      onmouseover="this.style.transform='scale(1.1)'" 
                      onmouseout="this.style.transform='scale(1)'"
                      onclick="event.stopPropagation(); window.plannerToggleCompletion && window.plannerToggleCompletion('${eventId}')"
                      title="${completed ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: iconHtml }} />
      <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </div>
    </div>
  );
}
