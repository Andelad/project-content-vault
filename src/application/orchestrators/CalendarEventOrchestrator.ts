/**
 * Calendar Event Orchestrator
 * Handles all event-related workflows
 * 
 * CONSOLIDATED FROM:
 * - CalendarEventOrchestrator.ts (event CRUD workflows via forms)
 * - PlannerViewOrchestrator.ts (drag/drop/resize interactions)
 * - recurringEventsOrchestrator.ts (recurring series maintenance)
 * 
 * This is a PURE ORCHESTRATOR - coordinates workflows only, no business logic!
 * All business rules must live in domain/rules/events/
 */

import { CalendarEvent } from '@/shared/types/core';
import { supabase } from '@/infrastructure/database/client';
import { generateRecurringEvents, calculateRecurringEventsNeeded, calculateDayDifference } from '@/domain/rules/events/EventCalculations';
import { addDaysToDate, calculateDurationHours } from '@/presentation/app/utils/dateCalculations';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { CalendarEvent as CalendarEventEntity } from '@/domain/entities/CalendarEvent';
import { useToast } from '@/hooks/ui/use-toast';
import { CalendarEventRules } from '@/domain/rules/events/EventValidation';

// ============================================================================
// SECTION 1: EVENT CRUD OPERATIONS (via forms)
// ============================================================================

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

// ============================================================================
// SECTION 2: INTERACTIVE EVENT UPDATES (drag/drop/resize)
// ============================================================================

export interface EventUpdateData {
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  completed?: boolean;
  [key: string]: unknown;
}

export interface PlannerEventResult {
  success: boolean;
  shouldRevert?: boolean;
  error?: string;
}

export interface PlannerInteractionContext {
  updateEventWithUndo: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  events: CalendarEvent[];
  isTimeTracking: boolean;
  toast: ReturnType<typeof useToast>['toast'];
}

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class CalendarEventOrchestrator {
  private plannerContext?: PlannerInteractionContext;

  constructor(plannerContext?: PlannerInteractionContext) {
    this.plannerContext = plannerContext;
  }

  // --------------------------------------------------------------------------
  // SECTION 1: EVENT CRUD OPERATIONS
  // --------------------------------------------------------------------------

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

    // DELEGATE recurring validation to domain rules
    if (formData.isRecurring) {
      const recurringValidation = CalendarEventRules.validateRecurringEvent(
        {
          type: formData.recurringType,
          interval: formData.recurringInterval,
          endType: formData.recurringEndType,
          endDate: formData.recurringEndDate,
          count: formData.recurringCount,
          monthlyPattern: formData.monthlyPattern,
          monthlyDate: formData.monthlyDate,
          monthlyWeekOfMonth: formData.monthlyWeekOfMonth,
          monthlyDayOfWeek: formData.monthlyDayOfWeek
        },
        this.parseDateTime(formData.startDate, formData.startTime)
      );
      
      if (!recurringValidation.isValid) {
        Object.assign(errors, recurringValidation.errors);
      }
    }

    return errors;
  }

  /**
   * Transforms form data into calendar event data
   */
  transformFormToEventData(formData: EventFormData, existingEvent?: CalendarEvent): Omit<CalendarEvent, 'id'> {
    const startDateTime = this.parseDateTime(formData.startDate, formData.startTime);
    const endDateTime = this.parseDateTime(formData.endDate, formData.endTime);
    const duration = calculateDurationHours(startDateTime, endDateTime); // Use utility function
    
    // Determine the title: Manual entry in description always takes precedence
    let title: string;
    if (formData.description.trim()) {
      title = formData.description.trim();
    } else {
      title = 'Untitled Event';
    }
    
    const eventData: Omit<CalendarEvent, 'id'> = {
      title,
      description: formData.notes.trim() || undefined,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      // Habits and tasks don't have project associations
      projectId: (formData.category === 'habit' || formData.category === 'task') ? undefined : (formData.projectId || undefined),
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
      const errors = this.validateEventForm(formData);
      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      const eventData = this.transformFormToEventData(formData);

      // Use CalendarEvent entity for validation
      const entityResult = CalendarEventEntity.create({
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        projectId: eventData.projectId,
        color: eventData.color,
        completed: eventData.completed,
        description: eventData.description,
        category: eventData.category,
        rrule: eventData.recurring ? undefined : undefined,
        recurring: eventData.recurring
      });

      if (!entityResult.success) {
        return { 
          success: false, 
          errors: { submit: entityResult.errors?.join(', ') }
        };
      }

      await addEvent(eventData);
      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to create event:' });
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
      const errors = this.validateEventForm(formData);
      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      const eventData = this.transformFormToEventData(formData, existingEvent);

      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;
        
      if (existingEvent.recurring || isRecurringEvent) {
        return { success: false, needsRecurringDialog: true };
      } else {
        await updateEvent(originalEventId, eventData);
        return { success: true };
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to update event:' });
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
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;
        
      await deleteEvent(originalEventId);
      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to delete event:' });
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
      const originalEventId = eventId?.includes('-split-') 
        ? eventId.split('-split-')[0] 
        : existingEvent.id;

      switch (updateType) {
        case 'this':
          await updateEvent(originalEventId, eventData);
          break;
        case 'future':
          await updateRecurringSeriesFuture(originalEventId, eventData);
          break;
        case 'all':
          await updateRecurringSeriesAll(originalEventId, eventData);
          break;
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: `Failed to update ${updateType} recurring events:` });
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
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: `Failed to delete ${deleteType} recurring events:` });
      return { 
        success: false, 
        errors: { submit: `Failed to delete ${deleteType} recurring events. Please try again.` }
      };
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 2: INTERACTIVE EVENT UPDATES (drag/drop/resize)
  // --------------------------------------------------------------------------

  /**
   * Orchestrates event drag and drop operations
   */
  async handleEventDragDrop(
    eventId: string,
    updates: EventUpdateData,
    revertCallback: () => void
  ): Promise<PlannerEventResult> {
    if (!this.plannerContext) {
      return { success: false, error: 'Planner context not initialized' };
    }

    try {
      // Skip work hour events - they have different handling
      if (eventId.startsWith('work-')) {
        return { success: true };
      }

      // Validate the update data
      const validationResult = this.validateEventUpdate(eventId, updates);
      if (!validationResult.isValid) {
        return { 
          success: false, 
          shouldRevert: true, 
          error: validationResult.error 
        };
      }

      // Apply the event update with undo support
      await this.plannerContext.updateEventWithUndo(eventId, updates);

      // Show success feedback
      this.plannerContext.toast({
        title: "Event updated",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to update event via drag:' });
      
      revertCallback();
      
      this.plannerContext.toast({
        title: "Failed to update event",
        description: "Please try again",
        variant: "destructive",
      });

      return { 
        success: false, 
        shouldRevert: true, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Orchestrates event resize operations
   */
  async handleEventResize(
    eventId: string,
    updates: EventUpdateData,
    revertCallback: () => void
  ): Promise<PlannerEventResult> {
    if (!this.plannerContext) {
      return { success: false, error: 'Planner context not initialized' };
    }

    try {
      // Skip work hour events
      if (eventId.startsWith('work-')) {
        return { success: true };
      }

      // Validate the resize data
      const validationResult = this.validateEventResize(eventId, updates);
      if (!validationResult.isValid) {
        return { 
          success: false, 
          shouldRevert: true, 
          error: validationResult.error 
        };
      }

      // Apply the event update with undo support
      await this.plannerContext.updateEventWithUndo(eventId, updates);

      // Show success feedback
      this.plannerContext.toast({
        title: "Event resized",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to resize event:' });
      
      revertCallback();
      
      this.plannerContext.toast({
        title: "Failed to resize event",
        description: "Please try again",
        variant: "destructive",
      });

      return { 
        success: false, 
        shouldRevert: true, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Orchestrates event completion toggle operations
   */
  async handleCompletionToggle(eventId: string): Promise<PlannerEventResult> {
    if (!this.plannerContext) {
      return { success: false, error: 'Planner context not initialized' };
    }

    try {
      const event = this.plannerContext.events.find(e => e.id === eventId);
      if (!event) {
        return { 
          success: false, 
          error: 'Event not found' 
        };
      }

      // Business rule: Don't allow toggling completion for currently tracking events
      if (event.type === 'tracked' && this.plannerContext.isTimeTracking) {
        return { 
          success: false, 
          error: 'Cannot toggle completion for currently tracking events' 
        };
      }

      // Apply the completion toggle with undo support
      await this.plannerContext.updateEventWithUndo(eventId, { completed: !event.completed });

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Failed to toggle completion:' });
      
      this.plannerContext.toast({
        title: "Failed to update event",
        description: "Please try again",
        variant: "destructive",
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Validates event update data for drag/drop operations
   */
  private validateEventUpdate(eventId: string, updates: EventUpdateData): { isValid: boolean; error?: string } {
    // Check if start time is before end time
    if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
      return { 
        isValid: false, 
        error: 'Start time must be before end time' 
      };
    }

    // Check for minimum duration (e.g., 15 minutes)
    if (updates.startTime && updates.endTime) {
      const durationMs = updates.endTime.getTime() - updates.startTime.getTime();
      const minDurationMs = 15 * 60 * 1000; // 15 minutes
      
      if (durationMs < minDurationMs) {
        return { 
          isValid: false, 
          error: 'Event must be at least 15 minutes long' 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validates event resize data
   */
  private validateEventResize(eventId: string, updates: EventUpdateData): { isValid: boolean; error?: string } {
    // Use the same validation as update for now
    return this.validateEventUpdate(eventId, updates);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: RECURRING SERIES MAINTENANCE
  // --------------------------------------------------------------------------

  /**
   * Checks if a recurring series needs more events generated and creates them if necessary
   * This should be called periodically or when viewing future dates
   */
  async ensureRecurringEventsExist(
    groupId: string,
    originalEvent: CalendarEvent,
    lookAheadMonths: number = 6
  ): Promise<number> {
    try {
      // Get all existing events in this recurring group
      const { data: existingEvents, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('recurring_group_id', groupId)
        .order('start_time', { ascending: true });

      if (error) throw error;

      if (!existingEvents || existingEvents.length === 0) {
        return 0;
      }

      // Find the last event in the series
      const lastEvent = existingEvents[existingEvents.length - 1];
      const lastEventDate = new Date(lastEvent.start_time);

      // Calculate the target date (look ahead)
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + lookAheadMonths);

      // If the last event is already beyond our look-ahead period, no need to generate more
      if (lastEventDate >= targetDate) {
        return 0;
      }

      // Reconstruct the original recurring configuration
      if (existingEvents.length < 2) {
        return 0;
      }

      const firstEvent = existingEvents[0];
      const secondEvent = existingEvents[1];
      
      const firstDate = new Date(firstEvent.start_time);
      const secondDate = new Date(secondEvent.start_time);
      const diffDays = calculateDayDifference(firstDate, secondDate);

      // Determine recurrence type and interval
      let recurringType: 'daily' | 'weekly' | 'monthly' | 'yearly';
      let interval: number;

      if (diffDays === 1) {
        recurringType = 'daily';
        interval = 1;
      } else if (diffDays === 7) {
        recurringType = 'weekly';
        interval = 1;
      } else if (diffDays % 7 === 0) {
        recurringType = 'weekly';
        interval = diffDays / 7;
      } else if (diffDays >= 28 && diffDays <= 31) {
        recurringType = 'monthly';
        interval = 1;
      } else if (diffDays >= 365 && diffDays <= 366) {
        recurringType = 'yearly';
        interval = 1;
      } else {
        recurringType = 'daily';
        interval = diffDays;
      }

      // Create a mock recurring event data to generate more events
      const mockEventData: Omit<CalendarEvent, 'id'> = {
        title: lastEvent.title,
        description: lastEvent.description || '',
        startTime: lastEventDate,
        endTime: new Date(lastEvent.end_time),
        projectId: lastEvent.project_id,
        color: lastEvent.color,
        completed: false,
        duration: lastEvent.duration || 0,
        type: (lastEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned',
        recurring: {
          type: recurringType,
          interval,
          count: this.calculateEventsNeeded(lastEventDate, targetDate, recurringType, interval)
        }
      };

      // Generate new events starting from the next occurrence after the last event
      const nextOccurrenceDate = this.calculateNextOccurrence(lastEventDate, recurringType, interval);
      mockEventData.startTime = nextOccurrenceDate;
      mockEventData.endTime = new Date(nextOccurrenceDate.getTime() + 
        (new Date(lastEvent.end_time).getTime() - lastEventDate.getTime()));

      const { events: newEvents } = generateRecurringEvents(mockEventData);

      // Insert new events into the database
      let createdCount = 0;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      for (const event of newEvents) {
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: user.id,
            title: event.title,
            description: event.description || '',
            start_time: event.startTime.toISOString(),
            end_time: event.endTime.toISOString(),
            project_id: event.projectId || null,
            color: event.color,
            completed: event.completed || false,
            duration: event.duration || 0,
            event_type: event.type || 'planned',
            recurring_group_id: groupId,
            recurring_type: null,
            recurring_interval: null,
            recurring_end_date: null,
            recurring_count: null
          });

        if (!insertError) {
          createdCount++;
        }
      }

      return createdCount;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Error ensuring recurring events exist:' });
      return 0;
    }
  }

  /**
   * Checks all recurring series and ensures they have sufficient future events
   * This can be called on app startup or periodically
   */
  async ensureAllRecurringSeriesHaveEvents(): Promise<void> {
    try {
      // Get all distinct recurring group IDs
      const { data: groupIds, error } = await supabase
        .from('calendar_events')
        .select('recurring_group_id')
        .not('recurring_group_id', 'is', null)
        .order('recurring_group_id');

      if (error) throw error;

      const uniqueGroupIds = Array.from(new Set(groupIds?.map(g => g.recurring_group_id) || []));

      for (const groupId of uniqueGroupIds) {
        if (groupId) {
          // Get the first event of this group to use as the template
          const { data: firstEvent, error: eventError } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('recurring_group_id', groupId)
            .order('start_time', { ascending: true })
            .limit(1)
            .single();

          if (eventError || !firstEvent) continue;

          const calendarEvent: CalendarEvent = {
            id: firstEvent.id,
            title: firstEvent.title,
            description: firstEvent.description || '',
            startTime: new Date(firstEvent.start_time),
            endTime: new Date(firstEvent.end_time),
            projectId: firstEvent.project_id,
            color: firstEvent.color,
            completed: firstEvent.completed || false,
            duration: firstEvent.duration || 0,
            type: (firstEvent.event_type as 'planned' | 'tracked' | 'completed') || 'planned'
          };

          await this.ensureRecurringEventsExist(groupId, calendarEvent);
        }
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarEventOrchestrator', action: 'Error ensuring all recurring series have events:' });
    }
  }

  private calculateNextOccurrence(
    date: Date, 
    type: 'daily' | 'weekly' | 'monthly' | 'yearly', 
    interval: number
  ): Date {
    let nextDate = new Date(date);
    
    switch (type) {
      case 'daily':
        nextDate = addDaysToDate(nextDate, interval);
        break;
      case 'weekly':
        nextDate = addDaysToDate(nextDate, 7 * interval);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }
    
    return nextDate;
  }

  private calculateEventsNeeded(
    startDate: Date,
    targetDate: Date,
    type: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number
  ): number {
    // DELEGATE to domain rules
    return calculateRecurringEventsNeeded(startDate, targetDate, type, interval);
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  /**
   * Helper method to parse date and time strings
   */
  private parseDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}`);
  }

  // Note: calculateDurationHours removed - use utils/dateCalculations.ts instead
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instance (for form-based workflows)
export const calendarEventOrchestrator = new CalendarEventOrchestrator();

// Export factory function for creating orchestrator instances (for planner view)
export const createCalendarEventOrchestrator = (context?: PlannerInteractionContext): CalendarEventOrchestrator => {
  return new CalendarEventOrchestrator(context);
};
