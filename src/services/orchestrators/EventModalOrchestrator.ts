/**
 * Event Modal Orchestrator
 * Handles complex event creation, editing, and deletion workflows for the event modal
 * 
 * Following AI Development Rules - orchestrators handle multi-step processes with database operations
 * Extracted from EventModal.tsx following Phase 3B Modal Component Orchestration
 */

import { CalendarEvent } from '@/types/core';

export interface EventFormData {
  description: string;
  notes: string;
  groupId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  projectId: string;
  color: string;
  completed: boolean;
  category: 'event' | 'habit' | 'task';
  isRecurring: boolean;
  recurringType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurringInterval: number;
  recurringEndType: 'never' | 'date' | 'count';
  recurringEndDate: string;
  recurringCount: number;
  monthlyPattern: 'date' | 'dayOfWeek';
  monthlyDate: number;
  monthlyWeekOfMonth: number;
  monthlyDayOfWeek: number;
}

export interface EventFormErrors {
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  recurringEndDate?: string;
  recurringInterval?: string;
  submit?: string;
}

export interface EventModalWorkflowResult {
  success: boolean;
  needsRecurringDialog?: boolean;
  errors?: EventFormErrors;
}

export class EventModalOrchestrator {
  constructor() {
    // No instance variables needed - using static validator methods
  }

  /**
   * Validates the event form data
   */
  validateEventForm(formData: EventFormData): EventFormErrors {
    const errors: EventFormErrors = {};

    if (!formData.startDate || !formData.startTime) {
      errors.startDateTime = 'Start date and time are required';
    }

    if (!formData.endDate || !formData.endTime) {
      errors.endDateTime = 'End date and time are required';
    }

    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const startDateTime = this.parseDateTime(formData.startDate, formData.startTime);
      const endDateTime = this.parseDateTime(formData.endDate, formData.endTime);

      if (startDateTime >= endDateTime) {
        errors.endDateTime = 'End time must be after start time';
      }
    }

    if (formData.isRecurring && formData.recurringEndType === 'date' && !formData.recurringEndDate) {
      errors.recurringEndDate = 'End date is required for recurring events';
    }

    if (formData.isRecurring && formData.recurringInterval < 1) {
      errors.recurringInterval = 'Interval must be at least 1';
    }

    return errors;
  }

  /**
   * Transforms form data into calendar event data
   */
  transformFormToEventData(formData: EventFormData, existingEvent?: CalendarEvent): Omit<CalendarEvent, 'id'> {
    const startDateTime = this.parseDateTime(formData.startDate, formData.startTime);
    const endDateTime = this.parseDateTime(formData.endDate, formData.endTime);
    const duration = this.calculateDurationHours(startDateTime, endDateTime);
    
    // Determine the title: Description always takes precedence, fallback to 'Tracked Time' only if no description
    let title: string;
    if (formData.description.trim()) {
      // If user provided a description, always use it (overrides 'Tracked Time')
      title = formData.description.trim();
    } else if (existingEvent?.title === 'Tracked Time' || existingEvent?.title?.includes('Tracked Time')) {
      // Only use 'Tracked Time' if no description provided and this was originally a tracked time event
      title = 'Tracked Time';
    } else {
      // Fallback for other cases
      title = formData.description.trim() || 'Untitled Event';
    }
    
    const eventData: Omit<CalendarEvent, 'id'> = {
      title,
      description: formData.notes.trim() || undefined,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      projectId: formData.projectId || undefined,
      color: formData.color,
      completed: formData.completed,
      category: formData.category
    };

    // Add recurring data if enabled
    if (formData.isRecurring) {
      eventData.recurring = {
        type: formData.recurringType,
        interval: formData.recurringInterval,
        ...(formData.recurringEndType === 'date' && formData.recurringEndDate && {
          endDate: new Date(formData.recurringEndDate)
        }),
        ...(formData.recurringEndType === 'count' && {
          count: formData.recurringCount
        }),
        ...(formData.recurringEndType === 'never' && {
          count: 52 // Default to 52 occurrences for "never" ending events
        }),
        // Add monthly pattern options
        ...(formData.recurringType === 'monthly' && {
          monthlyPattern: formData.monthlyPattern,
          monthlyDate: formData.monthlyDate,
          monthlyWeekOfMonth: formData.monthlyWeekOfMonth,
          monthlyDayOfWeek: formData.monthlyDayOfWeek
        })
      };
    }

    return eventData;
  }

  /**
   * Orchestrates event creation workflow
   */
  async createEventWorkflow(
    formData: EventFormData,
    addEvent: (eventData: Omit<CalendarEvent, 'id'>) => Promise<void>
  ): Promise<EventModalWorkflowResult> {
    try {
      // Validate form
      const errors = this.validateEventForm(formData);
      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      // Transform form data to event data
      const eventData = this.transformFormToEventData(formData);

      // For basic event validation, we'll skip the full context validation
      // and rely on form validation. Full validation would require context setup.
      // TODO: Add full context validation if needed

      // Pass the camelCase eventData directly to PlannerContext's addEvent
      // PlannerContext will handle the transformation to database format
      if (eventData.recurring) {
        // For recurring events, create first event immediately
        await addEvent(eventData as any);
        return { success: true };
      } else {
        // Single event - process normally
        await addEvent(eventData as any);
        return { success: true };
      }
    } catch (error) {
      console.error('EventModalOrchestrator: Failed to create event:', error);
      return { 
        success: false, 
        errors: { submit: 'Failed to create event. Please try again.' }
      };
    }
  }

  /**
   * Orchestrates event update workflow
   */
  async updateEventWorkflow(
    formData: EventFormData,
    existingEvent: CalendarEvent,
    eventId: string,
    isRecurringEvent: boolean,
    updateEvent: (id: string, eventData: Omit<CalendarEvent, 'id'>) => Promise<void>
  ): Promise<EventModalWorkflowResult> {
    try {
      // Validate form
      const errors = this.validateEventForm(formData);
      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      // Transform form data to event data
      const eventData = this.transformFormToEventData(formData, existingEvent);

      // For basic event validation, we'll skip the full context validation
      // and rely on form validation. Full validation would require context setup.
      // TODO: Add full context validation if needed

      // Get the original event ID in case this is a split event
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;
        
      // Check if this is a recurring event
      if (existingEvent.recurring || isRecurringEvent) {
        // Return to trigger recurring update dialog
        return { success: false, needsRecurringDialog: true };
      } else {
        // Non-recurring event, update directly
        // Pass camelCase eventData - PlannerContext handles transformation
        await updateEvent(originalEventId, eventData as any);
        return { success: true };
      }
    } catch (error) {
      console.error('EventModalOrchestrator: Failed to update event:', error);
      return { 
        success: false, 
        errors: { submit: 'Failed to update event. Please try again.' }
      };
    }
  }

  /**
   * Orchestrates single event deletion
   */
  async deleteEventWorkflow(
    existingEvent: CalendarEvent,
    eventId: string,
    deleteEvent: (id: string) => Promise<void>
  ): Promise<EventModalWorkflowResult> {
    try {
      // Get the original event ID in case this is a split event
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;
        
      await deleteEvent(originalEventId);
      return { success: true };
    } catch (error) {
      console.error('EventModalOrchestrator: Failed to delete event:', error);
      return { 
        success: false, 
        errors: { submit: 'Failed to delete event. Please try again.' }
      };
    }
  }

  /**
   * Orchestrates recurring event update workflows
   */
  async updateRecurringEventWorkflow(
    updateType: 'this' | 'future' | 'all',
    existingEvent: CalendarEvent,
    eventId: string,
    eventData: Omit<CalendarEvent, 'id'>,
    updateEvent: (id: string, eventData: Omit<CalendarEvent, 'id'>) => Promise<void>,
    updateRecurringSeriesFuture: (id: string, eventData: Omit<CalendarEvent, 'id'>) => Promise<void>,
    updateRecurringSeriesAll: (id: string, eventData: Omit<CalendarEvent, 'id'>) => Promise<void>
  ): Promise<EventModalWorkflowResult> {
    try {
      // Get the original event ID in case this is a split event
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;

      // Pass camelCase eventData - PlannerContext handles transformation
      switch (updateType) {
        case 'this':
          await updateEvent(originalEventId, eventData as any);
          break;
        case 'future':
          await updateRecurringSeriesFuture(originalEventId, eventData as any);
          break;
        case 'all':
          await updateRecurringSeriesAll(originalEventId, eventData as any);
          break;
      }

      return { success: true };
    } catch (error) {
      console.error(`EventModalOrchestrator: Failed to update ${updateType} recurring events:`, error);
      return { 
        success: false, 
        errors: { submit: `Failed to update ${updateType} recurring events. Please try again.` }
      };
    }
  }

  /**
   * Orchestrates recurring event deletion workflows
   */
  async deleteRecurringEventWorkflow(
    deleteType: 'this' | 'future' | 'all',
    existingEvent: CalendarEvent,
    eventId: string,
    deleteEvent: (id: string) => Promise<void>,
    deleteRecurringSeriesFuture: (id: string) => Promise<void>,
    deleteRecurringSeriesAll: (id: string) => Promise<void>
  ): Promise<EventModalWorkflowResult> {
    try {
      // Get the original event ID in case this is a split event
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;

      switch (deleteType) {
        case 'this':
          await deleteEvent(originalEventId);
          break;
        case 'future':
          await deleteRecurringSeriesFuture(originalEventId);
          break;
        case 'all':
          await deleteRecurringSeriesAll(originalEventId);
          break;
      }

      return { success: true };
    } catch (error) {
      console.error(`EventModalOrchestrator: Failed to delete ${deleteType} recurring events:`, error);
      return { 
        success: false, 
        errors: { submit: `Failed to delete ${deleteType} recurring events. Please try again.` }
      };
    }
  }

  /**
   * Helper method to parse date and time strings
   */
  private parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}`);
  }

  /**
   * Helper method to calculate duration in hours
   */
  private calculateDurationHours(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  }
}

// Export singleton instance
export const eventModalOrchestrator = new EventModalOrchestrator();
