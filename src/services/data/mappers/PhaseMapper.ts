/**
 * Phase Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (end_date ↔ endDate)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * ✅ Standardizes deprecated fields
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/integrations/supabase/types';
import type { PhaseDTO } from '@/types/core';

// Database types
type PhaseRow = Database['public']['Tables']['phases']['Row'];
type PhaseInsert = Database['public']['Tables']['phases']['Insert'];
type PhaseUpdate = Database['public']['Tables']['phases']['Update'];

/**
 * Phase Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const PhaseMapper = {
  /**
   * Convert database row to domain DTO
   * 
   * Handles:
   * - Field name standardization (end_date → endDate)
   * - Type conversions (string → Date)
   * - Backward compatibility (dueDate, timeAllocation)
   */
  fromDatabase(row: PhaseRow): PhaseDTO {
    const endDate = new Date(row.end_date);
    const startDate = new Date(row.start_date);
    const createdAt = new Date(row.created_at);
    const updatedAt = new Date(row.updated_at);

    return {
      id: row.id,
      name: row.name,
      projectId: row.project_id,
      
      // PRIMARY FIELDS (standardized)
      endDate,
      startDate,
      timeAllocationHours: row.time_allocation_hours ?? row.time_allocation,
      
      // BACKWARD COMPATIBILITY (deprecated fields)
      dueDate: endDate, // Same as endDate
      timeAllocation: row.time_allocation, // Legacy field
      
      // RECURRING PATTERNS
      isRecurring: row.is_recurring ?? false,
      recurringConfig: row.recurring_config ? (row.recurring_config as unknown as PhaseDTO['recurringConfig']) : undefined,
      
      // METADATA
      userId: row.user_id,
      createdAt,
      updatedAt,
    };
  },

  /**
   * Convert domain DTO to database insert payload
   * 
   * Handles:
   * - Field name translation (endDate → end_date)
   * - Type conversions (Date → ISO string)
   * - Required fields only (no ID, timestamps auto-generated)
   */
  toDatabase(phase: Partial<PhaseDTO> & { projectId: string; name: string }): PhaseInsert {
    // Support both endDate and dueDate (dueDate is deprecated)
    const endDateValue = phase.endDate ?? phase.dueDate;
    if (!endDateValue) {
      throw new Error('Phase endDate (or dueDate) is required');
    }

    const endDateIso = endDateValue instanceof Date 
      ? endDateValue.toISOString() 
      : endDateValue;

    const startDateValue = phase.startDate ?? endDateValue;
    const startDateIso = startDateValue instanceof Date
      ? startDateValue.toISOString()
      : startDateValue;

    // Use timeAllocationHours, fallback to timeAllocation (legacy)
    const timeAllocationHours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;

    return {
      name: phase.name,
      project_id: phase.projectId,
      end_date: endDateIso,
      start_date: startDateIso,
      time_allocation: timeAllocationHours, // Legacy field (still in DB)
      time_allocation_hours: timeAllocationHours,
      user_id: phase.userId!,
      
      // Optional recurring fields
      ...(phase.isRecurring !== undefined && { is_recurring: phase.isRecurring }),
      ...(phase.recurringConfig && { recurring_config: phase.recurringConfig as unknown as Database['public']['Tables']['phases']['Insert']['recurring_config'] }),
    };
  },

  /**
   * Convert domain DTO updates to database update payload
   * 
   * Only includes fields that are being updated.
   */
  toUpdatePayload(updates: Partial<PhaseDTO>): PhaseUpdate {
    const payload: PhaseUpdate = {};

    // Field name translations
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    
    // Date fields (support both endDate and dueDate)
    const endDateValue = updates.endDate ?? updates.dueDate;
    if (endDateValue !== undefined) {
      payload.end_date = endDateValue instanceof Date 
        ? endDateValue.toISOString() 
        : endDateValue;
    }

    if (updates.startDate !== undefined) {
      payload.start_date = updates.startDate instanceof Date
        ? updates.startDate.toISOString()
        : updates.startDate;
    }

    // Time allocation (support both new and legacy)
    if (updates.timeAllocationHours !== undefined || updates.timeAllocation !== undefined) {
      const value = updates.timeAllocationHours ?? updates.timeAllocation!;
      payload.time_allocation = value;
      payload.time_allocation_hours = value;
    }

    // Recurring fields
    if (updates.isRecurring !== undefined) {
      payload.is_recurring = updates.isRecurring;
    }
    if (updates.recurringConfig !== undefined) {
      payload.recurring_config = updates.recurringConfig as unknown as Database['public']['Tables']['phases']['Update']['recurring_config'];
    }

    return payload;
  },
};
