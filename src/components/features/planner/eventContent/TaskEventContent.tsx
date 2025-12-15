/**
 * TaskEventContent
 * 
 * Renders task events in the planner calendar.
 * Shows completion checkbox and title (no time display).
 */

import { CheckSquare, Square } from 'lucide-react';

// Extend window type for global handler
declare global {
  interface Window {
    plannerToggleCompletion?: (eventId: string) => void;
  }
}

interface TaskEventContentProps {
  eventId: string;
  title: string;
  completed: boolean;
  onToggleCompletion: (eventId: string) => void;
}

export function TaskEventContent({ eventId, title, completed }: TaskEventContentProps) {
  // Handle completion toggle safely
  const handleToggleCompletion = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.plannerToggleCompletion?.(eventId);
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', overflow: 'hidden' }}>
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
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {completed ? (
          <CheckSquare size={16} />
        ) : (
          <Square size={16} />
        )}
      </button>
      <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title}
      </div>
    </div>
  );
}
