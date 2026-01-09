import { useEffect } from 'react';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import { CalendarEvent } from '@/shared/types/core';

type LastAction = {
  type: 'update' | 'create' | 'delete';
  eventId: string;
  previousState?: Partial<CalendarEvent>;
  event?: CalendarEvent;
} | null;

interface CalendarKeyboardShortcutsConfig {
  // State setters
  setSelectedEventId: (id: string | null) => void;
  setIsLayersPopoverOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  
  // Current state values
  selectedEventId: string | null;
  currentView: 'week' | 'day';
  lastAction: LastAction;
  
  // Service/action callbacks
  undoLastAction: () => void;
  deleteEventWithUndo: (id: string) => void;
  handleNavigate: (direction: 'prev' | 'next' | 'today') => void;
  handleViewChange: (view: 'week' | 'day') => void;
}

/**
 * Custom hook for managing calendar keyboard shortcuts
 * 
 * Keyboard Shortcuts:
 * - Cmd/Ctrl + Z: Undo last action
 * - Escape: Clear selection
 * - Arrow Left/Right: Navigate prev/next period
 * - Arrow Up/Down: Switch between Week/Day views
 * - T: Go to Today
 * - L: Toggle layers visibility menu
 * - Delete/Backspace: Delete selected event
 * 
 * @example
 * ```tsx
 * useCalendarKeyboardShortcuts({
 *   setSelectedEventId,
 *   setIsLayersPopoverOpen,
 *   selectedEventId,
 *   currentView,
 *   lastAction,
 *   undoLastAction,
 *   deleteEventWithUndo,
 *   handleNavigate,
 *   handleViewChange
 * });
 * ```
 */
export function useCalendarKeyboardShortcuts({
  setSelectedEventId,
  setIsLayersPopoverOpen,
  selectedEventId,
  currentView,
  lastAction,
  undoLastAction,
  deleteEventWithUndo,
  handleNavigate,
  handleViewChange,
}: CalendarKeyboardShortcutsConfig) {
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).contentEditable === 'true'
      ) {
        return;
      }

      // Handle modifier key combinations
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (lastAction) {
              undoLastAction();
              toast({
                title: "Action undone",
                description: "Last change has been reverted",
                duration: 2000,
              });
            }
            break;
        }
        return;
      }

      // Handle regular keys
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setSelectedEventId(null);
          break;

        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate('prev');
          break;

        case 'ArrowRight':
          e.preventDefault();
          handleNavigate('next');
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentView === 'day') {
            handleViewChange('week');
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (currentView === 'week') {
            handleViewChange('day');
          }
          break;

        case 't':
        case 'T':
          e.preventDefault();
          handleNavigate('today');
          break;

        case 'l':
        case 'L':
          e.preventDefault();
          setIsLayersPopoverOpen(prev => !prev);
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          if (selectedEventId && !selectedEventId.startsWith('work-')) {
            deleteEventWithUndo(selectedEventId);
            setSelectedEventId(null);
            toast({
              title: "Event deleted",
              description: "Press Cmd+Z to undo",
              duration: 3000,
            });
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    lastAction,
    undoLastAction,
    toast,
    setSelectedEventId,
    selectedEventId,
    deleteEventWithUndo,
    handleNavigate,
    handleViewChange,
    currentView,
    setIsLayersPopoverOpen,
  ]);
}
