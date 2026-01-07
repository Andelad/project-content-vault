/**
 * Group Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (user_id ↔ userId)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/integrations/supabase/types';
import type { Group } from '@/types/core';

// Database types
type GroupRow = Database['public']['Tables']['groups']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['groups']['Update'];

/**
 * Group Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const GroupMapper = {
  /**
   * Convert database row to domain DTO
   */
  fromDatabase(row: GroupRow): Group {
    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  /**
   * Convert domain DTO to database insert payload
   */
  toDatabase(group: Partial<Group> & { name: string; userId: string }): GroupInsert {
    return {
      name: group.name,
      user_id: group.userId,
    };
  },

  /**
   * Convert domain DTO updates to database update payload
   */
  toUpdatePayload(updates: Partial<Group>): GroupUpdate {
    const payload: GroupUpdate = {};

    if (updates.name !== undefined) payload.name = updates.name;

    return payload;
  },
};
