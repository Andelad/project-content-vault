import ICAL from 'ical.js';
import { CalendarImportOrchestrator } from '../orchestrators/CalendarImportOrchestrator';
import { getDateKey } from '@/utils/dateFormatUtils';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

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
      ErrorHandlingService.handle(error, { source: 'UnifiedCalendarService', action: 'Error parsing iCal file:' });
      throw new Error(`Failed to parse iCal file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import external events into the calendar
   * Delegates to CalendarImportOrchestrator for database operations
   */
  static async importEvents(
    events: ExternalEvent[],
    projectId: string | null = null,
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<ImportResult> {
    // Delegate to orchestrator for workflow coordination and database operations
    return CalendarImportOrchestrator.executeImportWorkflow(
      events,
      projectId,
      dateRangeStart,
      dateRangeEnd
    );
  }
}