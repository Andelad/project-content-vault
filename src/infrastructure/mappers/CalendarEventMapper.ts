/**
 * CalendarEvent Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (start_time ↔ startTime)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * ✅ Handles recurring event fields (legacy + rrule)
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/infrastructure/database/types';
import type { CalendarEvent } from '@/shared/types/core';

// Database types
type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row'];
type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert'];
type CalendarEventUpdate = Database['public']['Tables']['calendar_events']['Update'];

/**
 * CalendarEvent Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const CalendarEventMapper = {
  /**
   * Convert database row to domain DTO
   * 
   * Handles:
   * - Field name standardization (start_time → startTime)
   * - Type conversions (string → Date)
   * - Recurring event fields (both legacy and rrule)
   */
  fromDatabase(row: CalendarEventRow): CalendarEvent {
    const startTime = new Date(row.start_time);
    const endTime = new Date(row.end_time);

    // Build legacy recurring config if present
    const recurring = (row.recurring_type && row.recurring_interval) ? {
      type: row.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: row.recurring_interval,
      ...(row.recurring_end_date && { endDate: new Date(row.recurring_end_date) }),
      ...(row.recurring_count && { count: row.recurring_count }),
    } : undefined;

    return {
      id: row.id,
      title: row.title,
      startTime,
      endTime,
      color: row.color,
      
      // Optional fields
      projectId: row.project_id ?? undefined,
      completed: row.completed ?? undefined,
      description: row.description ?? undefined,
      duration: row.duration ?? undefined,
      type: row.event_type as CalendarEvent['type'] | undefined,
      category: row.category as CalendarEvent['category'] | undefined,
      
      // Recurring fields (NEW system)
      rrule: row.rrule ?? undefined,
      recurringGroupId: row.recurring_group_id ?? undefined,
      
      // Recurring fields (LEGACY system)
      recurring,
    };
  },

  /**
   * Convert domain DTO to database insert payload
   * 
   * Handles:
   * - Field name translation (startTime → start_time)
   * - Type conversions (Date → ISO string)
   * - Recurring configuration
   */
  toDatabase(event: Partial<CalendarEvent> & { title: string; startTime: Date; endTime: Date; color: string; userId: string }): CalendarEventInsert {
    const startTimeIso = event.startTime instanceof Date
      ? event.startTime.toISOString()
      : event.startTime;

    const endTimeIso = event.endTime instanceof Date
      ? event.endTime.toISOString()
      : event.endTime;

    const payload: CalendarEventInsert = {
      title: event.title,
      start_time: startTimeIso,
      end_time: endTimeIso,
      color: event.color,
      user_id: event.userId,
      
      // Optional fields
      ...(event.projectId !== undefined && { project_id: event.projectId }),
      ...(event.completed !== undefined && { completed: event.completed }),
      ...(event.description !== undefined && { description: event.description }),
      ...(event.duration !== undefined && { duration: event.duration }),
      ...(event.type !== undefined && { event_type: event.type }),
      ...(event.category !== undefined && { category: event.category }),
      
      // Recurring fields (NEW system)
      ...(event.rrule !== undefined && { rrule: event.rrule }),
      ...(event.recurringGroupId !== undefined && { recurring_group_id: event.recurringGroupId }),
    };

    // Recurring fields (LEGACY system - if present)
    if (event.recurring) {
      payload.recurring_type = event.recurring.type;
      payload.recurring_interval = event.recurring.interval;
      if (event.recurring.endDate) {
        payload.recurring_end_date = event.recurring.endDate instanceof Date
          ? event.recurring.endDate.toISOString()
          : event.recurring.endDate;
      }
      if (event.recurring.count) {
        payload.recurring_count = event.recurring.count;
      }
    }

    return payload;
  },

  /**
   * Convert domain DTO updates to database update payload
   * 
   * Only includes fields that are being updated.
   */
  toUpdatePayload(updates: Partial<CalendarEvent>): CalendarEventUpdate {
    const payload: CalendarEventUpdate = {};

    // Basic fields
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.color !== undefined) payload.color = updates.color;
    
    // Date/time fields
    if (updates.startTime !== undefined) {
      payload.start_time = updates.startTime instanceof Date
        ? updates.startTime.toISOString()
        : updates.startTime;
    }
    if (updates.endTime !== undefined) {
      payload.end_time = updates.endTime instanceof Date
        ? updates.endTime.toISOString()
        : updates.endTime;
    }

    // Optional fields
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.completed !== undefined) payload.completed = updates.completed;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.duration !== undefined) payload.duration = updates.duration;
    if (updates.type !== undefined) payload.event_type = updates.type;
    if (updates.category !== undefined) payload.category = updates.category;
    
    // Recurring fields (NEW system)
    if (updates.rrule !== undefined) payload.rrule = updates.rrule;
    if (updates.recurringGroupId !== undefined) payload.recurring_group_id = updates.recurringGroupId;
    
    // Recurring fields (LEGACY system)
    if (updates.recurring !== undefined) {
      if (updates.recurring) {
        payload.recurring_type = updates.recurring.type;
        payload.recurring_interval = updates.recurring.interval;
        if (updates.recurring.endDate) {
          payload.recurring_end_date = updates.recurring.endDate instanceof Date
            ? updates.recurring.endDate.toISOString()
            : updates.recurring.endDate;
        }
        if (updates.recurring.count) {
          payload.recurring_count = updates.recurring.count;
        }
      } else {
        // Clear recurring fields if set to undefined/null
        payload.recurring_type = null;
        payload.recurring_interval = null;
        payload.recurring_end_date = null;
        payload.recurring_count = null;
      }
    }

    return payload;
  },
};
