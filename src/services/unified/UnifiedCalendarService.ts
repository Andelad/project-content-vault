import ICAL from 'ical.js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateDurationHours } from '@/services/calculations/general/dateCalculations';
import { getDateKey } from '@/utils/dateFormatUtils';

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

export class CalendarIntegrationService {
  
  /**
   * Parse iCal (.ics) file content and extract events
   */
  static parseICalFile(fileContent: string): ExternalEvent[] {
    try {
      const jcalData = ICAL.parse(fileContent);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      
      return vevents.map(vevent => {
        const event = new ICAL.Event(vevent);
        
        return {
          title: event.summary || 'Untitled Event',
          startTime: event.startDate.toJSDate(),
          endTime: event.endDate.toJSDate(),
          description: event.description || undefined,
          location: event.location || undefined,
          externalId: event.uid,
          externalSource: 'ical' as const,
          externalUrl: undefined,
          externalLastModified: undefined // TODO: Parse last-modified from iCal if needed
        };
      });
    } catch (error) {
      console.error('Error parsing iCal file:', error);
      throw new Error(`Failed to parse iCal file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import external events into the calendar_events table
   */
  static async importEvents(
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
            // ✅ DELEGATE to domain layer - no manual date math!
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
    } catch (error) {
      console.error('Error during import:', error);
      result.success = false;
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Record import history in the database
   */
  static async recordImportHistory(
    importSource: 'ical_file' | 'google' | 'outlook',
    importType: 'manual' | 'scheduled',
    result: ImportResult,
    fileName?: string,
    connectionId?: string,
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await supabase
        .from('calendar_import_history')
        .insert([{
          user_id: user.id,
          import_source: importSource,
          import_type: importType,
          file_name: fileName,
          connection_id: connectionId,
          events_imported: result.imported,
          events_updated: result.updated,
          events_failed: result.failed,
          import_status: result.success ? 'completed' : 'failed',
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          import_date_range_start: dateRangeStart ? getDateKey(dateRangeStart) : null,
          import_date_range_end: dateRangeEnd ? getDateKey(dateRangeEnd) : null
        }]);
    } catch (error) {
      console.error('Error recording import history:', error);
    }
  }
}