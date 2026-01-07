/**
 * Project Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (client_id ↔ clientId)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * ✅ Handles JSON fields (working_day_overrides)
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/integrations/supabase/types';
import type { Project, ProjectStatus } from '@/types/core';

// Database types
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

/**
 * Project Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const ProjectMapper = {
  /**
   * Convert database row to domain DTO
   * 
   * Handles:
   * - Field name standardization (client_id → clientId)
   * - Type conversions (string → Date)
   * - JSON field parsing (working_day_overrides)
   */
  fromDatabase(row: ProjectRow): Project {
    const startDate = new Date(row.start_date);
    const endDate = new Date(row.end_date);
    const createdAt = new Date(row.created_at);
    const updatedAt = new Date(row.updated_at);

    return {
      id: row.id,
      name: row.name,
      
      // DEPRECATED FIELDS (backward compatibility)
      client: row.client,
      rowId: row.row_id ?? undefined,
      
      // REQUIRED FIELDS
      clientId: row.client_id,
      startDate,
      endDate,
      estimatedHours: row.estimated_hours,
      color: row.color,
      groupId: row.group_id,
      
      // OPTIONAL FIELDS
      notes: row.notes ?? undefined,
      icon: row.icon ?? undefined,
      continuous: row.continuous ?? undefined,
      
      // WORKING DAY OVERRIDES
      autoEstimateDays: row.working_day_overrides 
        ? (row.working_day_overrides as unknown as Project['autoEstimateDays'])
        : undefined,
      
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
   * - Field name translation (clientId → client_id)
   * - Type conversions (Date → ISO string)
   * - Required fields only (no ID, timestamps auto-generated)
   */
  toDatabase(project: Partial<Project> & { name: string; clientId: string; startDate: Date; endDate: Date; estimatedHours: number; groupId: string; color: string; userId: string }): ProjectInsert {
    const startDateIso = project.startDate instanceof Date
      ? project.startDate.toISOString()
      : project.startDate;

    const endDateIso = project.endDate instanceof Date
      ? project.endDate.toISOString()
      : project.endDate;

    return {
      name: project.name,
      client: project.client ?? project.clientId, // Backward compatibility
      client_id: project.clientId,
      start_date: startDateIso,
      end_date: endDateIso,
      estimated_hours: project.estimatedHours,
      color: project.color,
      group_id: project.groupId,
      user_id: project.userId,
      
      // Optional fields
      ...(project.notes !== undefined && { notes: project.notes }),
      ...(project.icon !== undefined && { icon: project.icon }),
      ...(project.continuous !== undefined && { continuous: project.continuous }),
      ...(project.rowId !== undefined && { row_id: project.rowId }),
      ...(project.autoEstimateDays && { 
        working_day_overrides: project.autoEstimateDays as unknown as Database['public']['Tables']['projects']['Insert']['working_day_overrides']
      }),
    };
  },

  /**
   * Convert domain DTO updates to database update payload
   * 
   * Only includes fields that are being updated.
   */
  toUpdatePayload(updates: Partial<Project>): ProjectUpdate {
    const payload: ProjectUpdate = {};

    // Field name translations
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.clientId !== undefined) {
      payload.client_id = updates.clientId;
      payload.client = updates.client ?? updates.clientId; // Backward compatibility
    }
    if (updates.client !== undefined && !updates.clientId) {
      payload.client = updates.client;
    }
    
    // Date fields
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

    // Number fields
    if (updates.estimatedHours !== undefined) {
      payload.estimated_hours = updates.estimatedHours;
    }

    // String fields
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.groupId !== undefined) payload.group_id = updates.groupId;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.icon !== undefined) payload.icon = updates.icon;
    if (updates.rowId !== undefined) payload.row_id = updates.rowId;
    
    // Boolean fields
    if (updates.continuous !== undefined) {
      payload.continuous = updates.continuous;
    }

    // JSON fields
    if (updates.autoEstimateDays !== undefined) {
      payload.working_day_overrides = updates.autoEstimateDays as unknown as Database['public']['Tables']['projects']['Update']['working_day_overrides'];
    }

    return payload;
  },
};
