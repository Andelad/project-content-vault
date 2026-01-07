/**
 * Planner View Orchestrator
 * Handles complex event interactions in the planner view including drag/drop, resize, and completion
 * 
 * Following AI Development Rules - orchestrators handle multi-step processes with database operations
 * Extracted from PlannerView.tsx following Phase 3C Planner View Orchestration
 */

import { CalendarEvent } from '@/types/core';
import { useToast } from '@/hooks/ui/use-toast';
import { transformFullCalendarToCalendarEvent } from '@/services';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';

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

export class PlannerViewOrchestrator {
  private context: PlannerInteractionContext;

  constructor(context: PlannerInteractionContext) {
    this.context = context;
  }

  /**
   * Orchestrates event drag and drop operations
   */
  async handleEventDragDrop(
    eventId: string,
    updates: EventUpdateData,
    revertCallback: () => void
  ): Promise<PlannerEventResult> {
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
      await this.context.updateEventWithUndo(eventId, updates);

      // Show success feedback
      this.context.toast({
        title: "Event updated",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PlannerViewOrchestrator', action: 'PlannerViewOrchestrator: Failed to update event via drag:' });
      
      // Revert the visual change
      revertCallback();
      
      // Show error feedback
      this.context.toast({
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
    try {
      // Skip work hour events - they have different handling
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
      await this.context.updateEventWithUndo(eventId, updates);

      // Show success feedback
      this.context.toast({
        title: "Event resized",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PlannerViewOrchestrator', action: 'PlannerViewOrchestrator: Failed to resize event:' });
      
      // Revert the visual change
      revertCallback();
      
      // Show error feedback
      this.context.toast({
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
    try {
      const event = this.context.events.find(e => e.id === eventId);
      if (!event) {
        return { 
          success: false, 
          error: 'Event not found' 
        };
      }

      // Business rule: Don't allow toggling completion for currently tracking events
      if (event.type === 'tracked' && this.context.isTimeTracking) {
        return { 
          success: false, 
          error: 'Cannot toggle completion for currently tracking events' 
        };
      }

      // Apply the completion toggle with undo support
      await this.context.updateEventWithUndo(eventId, { completed: !event.completed });

      // Success feedback is handled by the updateEventWithUndo function
      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'PlannerViewOrchestrator', action: 'PlannerViewOrchestrator: Failed to toggle completion:' });
      
      // Show error feedback
      this.context.toast({
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
}

// Export factory function for creating orchestrator instances
export const createPlannerViewOrchestrator = (context: PlannerInteractionContext): PlannerViewOrchestrator => {
  return new PlannerViewOrchestrator(context);
};
