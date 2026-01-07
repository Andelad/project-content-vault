/**
 * Calendar Import Orchestrator
 *
 * Handles calendar import workflows with validation and database operations.
 * Coordinates between external calendar sources and the application's calendar events.
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateDurationHours } from '@/services';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';

export interface ExternalEvent {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  location?: string;
  externalId: string;
  externalSource: 'ical' | 'google' | 'outlook';
  externalUrl?: string;
  externalLastModified?: Date;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
}

export class CalendarImportOrchestrator {

  /**
   * Execute calendar import workflow
   * Handles validation, deduplication, and database operations
   */
  static async executeImportWorkflow(
    events: ExternalEvent[],
    projectId: string | null = null,
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Filter events by date range if specified
      const filteredEvents = events.filter(event => {
        if (dateRangeStart && event.startTime < dateRangeStart) return false;
        if (dateRangeEnd && event.startTime > dateRangeEnd) return false;
        return true;
      });

      for (const event of filteredEvents) {
        try {
          // Check if event already exists
          const { data: existingEvent } = await supabase
            .from('calendar_events')
            .select('id, external_last_modified')
            .eq('external_calendar_id', event.externalId)
            .eq('external_source', event.externalSource)
            .eq('user_id', user.id)
            .single();

          const eventData = {
            user_id: user.id,
            project_id: projectId,
            title: event.title,
            description: event.description,
            start_time: event.startTime.toISOString(),
            end_time: event.endTime.toISOString(),
            color: '#3b82f6', // Default blue color for imported events
            external_calendar_id: event.externalId,
            external_source: event.externalSource,
            external_url: event.externalUrl,
            external_last_modified: event.externalLastModified?.toISOString(),
            is_external_event: true,
            // Delegate to calculation function for duration
            duration: calculateDurationHours(event.startTime, event.endTime)
          };

          if (existingEvent) {
            // Update existing event if it has been modified
            const shouldUpdate = !event.externalLastModified ||
              !existingEvent.external_last_modified ||
              new Date(event.externalLastModified) > new Date(existingEvent.external_last_modified);

            if (shouldUpdate) {
              const { error } = await supabase
                .from('calendar_events')
                .update(eventData)
                .eq('id', existingEvent.id);

              if (error) throw error;
              result.updated++;
            }
          } else {
            // Insert new event
            const { error } = await supabase
              .from('calendar_events')
              .insert([eventData]);

            if (error) throw error;
            result.imported++;
          }
        } catch (error) {
          console.error('Error importing event:', event.title, error);
          result.failed++;
          result.errors.push(`Failed to import "${event.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Log import summary
      await this.logImportHistory(result, user.id);

    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'CalendarImportOrchestrator', action: 'Error during import:' });
      result.success = false;
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Log import history for tracking
   */
  private static async logImportHistory(result: ImportResult, userId: string): Promise<void> {
    try {
      await supabase
        .from('calendar_import_history')
        .insert([{
          user_id: userId,
          import_source: 'ical_file', // Default to ical for now
          import_type: 'manual',
          events_imported: result.imported,
          events_updated: result.updated,
          events_failed: result.failed,
          import_status: result.success ? 'completed' : 'failed',
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          import_date_range_start: null, // Could be added later if needed
          import_date_range_end: null
        }]);
    } catch (error) {
      console.warn('Failed to log import history:', error);
      // Don't fail the import if logging fails
    }
  }
}
