/**
 * useCalendarDragDrop
 * 
 * Custom hook for handling drag/drop of projects from summary row to calendar.
 * Coordinates DOM events with calendar API and event creation.
 * 
 * Architecture:
 * - Manages React state for drag operations
 * - Handles DOM drag/drop events
 * - Coordinates with calendar API for positioning
 * - Triggers event creation via context
 */

import { useEffect } from 'react';
import type FullCalendar from '@fullcalendar/react';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';;
import type { CalendarEvent } from '@/shared/types';

interface UseCalendarDragDropProps {
  calendarRef: React.RefObject<FullCalendar>;
  events: CalendarEvent[];
  setCreatingNewEvent: (config: { startTime: Date; endTime: Date } | null) => void;
  toast: (config: { title: string; description: string; variant?: 'default' | 'destructive'; duration?: number }) => void;
}

export function useCalendarDragDrop({
  calendarRef,
  events,
  setCreatingNewEvent,
  toast
}: UseCalendarDragDropProps) {
  useEffect(() => {
    const calendarEl = document.querySelector('.fc-timegrid-body');
    if (!calendarEl) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

  const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      
      try {
        const data = JSON.parse(e.dataTransfer!.getData('application/json')) as {
          type: string;
          projectId: string;
          estimatedHours: number;
        };
        if (data.type !== 'project-estimate') return;

        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return;

        // Get the column (day) from the mouse position
        const timeSlotElements = document.querySelectorAll('.fc-timegrid-col');
        let targetDate: Date | null = null;

        // Find which column was dropped on
        for (const col of Array.from(timeSlotElements)) {
          const rect = col.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const dataDate = col.getAttribute('data-date');
            if (dataDate) {
              targetDate = new Date(dataDate);
              
              // Calculate time from Y position within the column
              const relativeY = e.clientY - rect.top;
              const totalHeight = rect.height;
              const fractionOfDay = relativeY / totalHeight;
              
              // Assuming 24-hour day view
              const totalMinutes = 24 * 60;
              const minutesFromMidnight = fractionOfDay * totalMinutes;
              
              // Round to nearest 15 minutes
              const roundedMinutes = Math.round(minutesFromMidnight / 15) * 15;
              const hours = Math.floor(roundedMinutes / 60);
              const minutes = roundedMinutes % 60;
              
              targetDate.setHours(hours, minutes, 0, 0);
              break;
            }
          }
        }

        if (!targetDate) {
          toast({
            title: "Invalid drop location",
            description: "Please drop on the calendar grid",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }

        const startTime = targetDate;
        
        // Calculate end time based on estimated hours
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + Math.floor(data.estimatedHours));
        endTime.setMinutes(endTime.getMinutes() + Math.round((data.estimatedHours % 1) * 60));

        // Check for overlapping events and compress if needed
        const overlappingEvents = events.filter(event => {
          if (event.projectId !== data.projectId) return false;
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          return (startTime < eventEnd && endTime > eventStart);
        });

        let finalEndTime = endTime;
        if (overlappingEvents.length > 0) {
          // Find the earliest overlapping event
          const earliestOverlap = overlappingEvents.reduce((earliest, event) => {
            const eventStart = new Date(event.startTime);
            return eventStart < earliest ? eventStart : earliest;
          }, new Date(endTime));

          // Compress to fit before the overlap
          if (earliestOverlap > startTime) {
            finalEndTime = earliestOverlap;
          } else {
            // Can't fit, show toast
            toast({
              title: "Cannot create event",
              description: "No space available at this time",
              variant: "destructive",
              duration: 3000,
            });
            return;
          }
        }

        // Store project ID for modal to use
        type PlannerWindow = Window & { __pendingEventProjectId?: string };
        (window as PlannerWindow).__pendingEventProjectId = data.projectId;
        setCreatingNewEvent({
          startTime,
          endTime: finalEndTime
        });
      } catch (error) {
        ErrorHandlingService.handle(error, { 
          source: 'useCalendarDragDrop', 
          action: 'handleDrop' 
        });
      }
    };

    calendarEl.addEventListener('dragover', handleDragOver as EventListener);
    calendarEl.addEventListener('drop', handleDrop as EventListener);

    return () => {
      calendarEl.removeEventListener('dragover', handleDragOver as EventListener);
      calendarEl.removeEventListener('drop', handleDrop as EventListener);
    };
  }, [calendarRef, events, setCreatingNewEvent, toast]);
}
