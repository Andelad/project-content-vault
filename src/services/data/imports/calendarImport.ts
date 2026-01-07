/**
 * Calendar Import Data Transformations
 * 
 * RESPONSIBILITIES:
 * - Parse external calendar formats (iCal, etc.) into standard format
 * - Transform external event data into ExternalEvent DTOs
 * - Data validation and error handling during parsing
 * 
 * NOT RESPONSIBLE FOR:
 * - Database operations (orchestrators handle this)
 * - Business logic (domain rules handle this)
 * - Workflow coordination (orchestrators handle this)
 */
import ICAL from 'ical.js';
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

/**
 * Parse iCal (.ics) file content and extract events
 */
export function parseICalFile(fileContent: string): ExternalEvent[] {
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
    ErrorHandlingService.handle(error, { source: 'parseICalFile', action: 'Error parsing iCal file:' });
    throw new Error(`Failed to parse iCal file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
