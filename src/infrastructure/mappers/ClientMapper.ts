/**
 * Client Data Mapper
 * 
 * Handles transformation between database rows and domain DTOs.
 * 
 * ✅ ONLY does data transformation (no business logic)
 * ✅ Handles field name translations (contact_email ↔ contactEmail)
 * ✅ Handles type conversions (string dates ↔ Date objects)
 * 
 * Architecture Layer: services/data/mappers/
 * - Transforms DB types → Domain types
 * - Transforms Domain types → DB types
 * - NO business logic (that belongs in domain/rules/)
 */

import type { Database } from '@/infrastructure/database/types';
import type { Client, ClientStatus } from '@/shared/types/core';

// Database types
type ClientRow = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];

/**
 * Client Data Mapper
 * 
 * Converts between database representation and domain DTOs.
 */
export const ClientMapper = {
  /**
   * Convert database row to domain DTO
   */
  fromDatabase(row: ClientRow): Client {
    return {
      id: row.id,
      name: row.name,
      status: row.status as ClientStatus,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      billingAddress: row.billing_address ?? undefined,
      notes: row.notes ?? undefined,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  /**
   * Convert domain DTO to database insert payload
   */
  toDatabase(client: Partial<Client> & { name: string; userId: string }): ClientInsert {
    return {
      name: client.name,
      user_id: client.userId,
      status: client.status ?? 'active',
      ...(client.contactEmail !== undefined && { contact_email: client.contactEmail }),
      ...(client.contactPhone !== undefined && { contact_phone: client.contactPhone }),
      ...(client.billingAddress !== undefined && { billing_address: client.billingAddress }),
      ...(client.notes !== undefined && { notes: client.notes }),
    };
  },

  /**
   * Convert domain DTO updates to database update payload
   */
  toUpdatePayload(updates: Partial<Client>): ClientUpdate {
    const payload: ClientUpdate = {};

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.billingAddress !== undefined) payload.billing_address = updates.billingAddress;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    return payload;
  },
};
