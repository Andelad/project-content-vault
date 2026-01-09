/**
 * Holiday Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (start_date ↔ startDate)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/infrastructure/database/types';
import type { Holiday } from '@/shared/types/core';

// Database types
type HolidayRow = Database['public']['Tables']['holidays']['Row'];
type HolidayInsert = Database['public']['Tables']['holidays']['Insert'];
type HolidayUpdate = Database['public']['Tables']['holidays']['Update'];

/**
 * Holiday Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const HolidayMapper = {
  /**
   * Convert database row to domain DTO
   */
  fromDatabase(row: HolidayRow): Holiday {
    return {
      id: row.id,
      title: row.title,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      notes: row.notes ?? undefined,
    };
  },

  /**
   * Convert domain DTO to database insert payload
   */
  toDatabase(holiday: Partial<Holiday> & { title: string; startDate: Date; endDate: Date; userId: string }): HolidayInsert {
    const startDateIso = holiday.startDate instanceof Date
      ? holiday.startDate.toISOString()
      : holiday.startDate;

    const endDateIso = holiday.endDate instanceof Date
      ? holiday.endDate.toISOString()
      : holiday.endDate;

    return {
      title: holiday.title,
      start_date: startDateIso,
      end_date: endDateIso,
      user_id: holiday.userId,
      ...(holiday.notes !== undefined && { notes: holiday.notes }),
    };
  },

  /**
   * Convert domain DTO updates to database update payload
   */
  toUpdatePayload(updates: Partial<Holiday>): HolidayUpdate {
    const payload: HolidayUpdate = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    
    if (updates.startDate !== undefined) {
      payload.start_date = updates.startDate instanceof Date
        ? updates.startDate.toISOString()
        : updates.startDate;
    }
    
    if (updates.endDate !== undefined) {
      payload.end_date = updates.endDate instanceof Date
        ? updates.endDate.toISOString()
        : updates.endDate;
    }

    return payload;
  },
};
