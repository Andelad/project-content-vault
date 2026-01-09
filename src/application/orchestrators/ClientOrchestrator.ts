/**
 * Client Orchestrator - Phase 5B
 * 
 * Coordinates client domain rules with database operations.
 * Handles client CRUD workflows with validation and error handling.
 * 
 * @module ClientOrchestrator
 */

import { Client, ClientStatus } from '@/shared/types/core';
import { ClientRules } from '@/domain/rules/clients/ClientValidation';
import { supabase } from '@/infrastructure/database/client';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { Client as ClientEntity } from '@/domain/entities/Client';

export interface ClientValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ClientCreationResult {
  success: boolean;
  client?: Client;
  errors?: string[];
}

export interface ClientUpdateResult {
  success: boolean;
  client?: Client;
  errors?: string[];
}

export interface ClientDeletionResult {
  success: boolean;
  errors?: string[];
}

type DbClientRow = {
  id: string;
  user_id: string;
  name: string;
  status: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Client Orchestrator
 * Handles client business workflows
 */
export class ClientOrchestrator {
  /**
   * Get all clients for current user
   */
  static async getAllClients(): Promise<Client[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ClientOrchestrator', 
          action: 'getAllClients' 
        });
        throw error;
      }

      // Transform to frontend format
      return (data || []).map(row => this.transformDatabaseClient(row));
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ClientOrchestrator', 
        action: 'getAllClients error' 
      });
      throw error;
    }
  }

  /**
   * Create new client with validation
   */
  static async createClientWorkflow(
    clientData: Partial<Client>
  ): Promise<ClientCreationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          errors: ['User not authenticated']
        };
      }

      // Fetch existing clients for duplicate name validation
      const existingClients = await this.getAllClients();

      // Use Client entity for validation
      const entityResult = ClientEntity.create({
        name: clientData.name || '',
        userId: user.id,
        status: (clientData.status as ClientStatus) || 'active',
        contactEmail: clientData.contactEmail,
        contactPhone: clientData.contactPhone,
        billingAddress: clientData.billingAddress,
        notes: clientData.notes,
        existingClients: existingClients.map(c => ({
          id: c.id,
          userId: c.userId,
          name: c.name,
          status: c.status,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          billingAddress: c.billingAddress,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      });

      if (!entityResult.success) {
        return {
          success: false,
          errors: entityResult.errors
        };
      }

      // Extract validated data from entity
      const clientEntity = entityResult.data!;
      const validatedData = clientEntity.toData();

      const { data, error } = await supabase
        .from('clients')
        .insert([{
          user_id: validatedData.userId,
          name: validatedData.name,
          status: validatedData.status,
          contact_email: validatedData.contactEmail,
          contact_phone: validatedData.contactPhone,
          billing_address: validatedData.billingAddress,
          notes: validatedData.notes,
        }])
        .select()
        .single();

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ClientOrchestrator', 
          action: 'createClientWorkflow' 
        });
        throw error;
      }

      const newClient = this.transformDatabaseClient(data);

      return {
        success: true,
        client: newClient
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ClientOrchestrator', 
        action: 'createClientWorkflow error' 
      });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Creation failed']
      };
    }
  }

  /**
   * Update existing client with validation
   */
  static async updateClientWorkflow(
    clientId: string,
    updates: Partial<Client>
  ): Promise<ClientUpdateResult> {
    try {
      // Validate updates
      const validation = ClientRules.validateClient(updates);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const { error } = await supabase
        .from('clients')
        .update({
          name: updates.name,
          status: updates.status,
          contact_email: updates.contactEmail,
          contact_phone: updates.contactPhone,
          billing_address: updates.billingAddress,
          notes: updates.notes,
        })
        .eq('id', clientId);

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ClientOrchestrator', 
          action: 'updateClientWorkflow' 
        });
        throw error;
      }

      return {
        success: true
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ClientOrchestrator', 
        action: 'updateClientWorkflow error' 
      });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Update failed']
      };
    }
  }

  /**
   * Delete client
   * Note: Will fail if client has associated projects (ON DELETE RESTRICT)
   */
  static async deleteClientWorkflow(
    clientId: string
  ): Promise<ClientDeletionResult> {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) {
        // Check if it's a foreign key constraint error
        if (error.code === '23503') {
          return {
            success: false,
            errors: ['Cannot delete client with associated projects. Delete projects first.']
          };
        }
        
        ErrorHandlingService.handle(error, { 
          source: 'ClientOrchestrator', 
          action: 'deleteClientWorkflow' 
        });
        throw error;
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ClientOrchestrator', 
        action: 'deleteClientWorkflow error' 
      });
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Delete failed']
      };
    }
  }

  /**
   * Transform database client to frontend format
   */
  private static transformDatabaseClient(dbClient: DbClientRow): Client {
    return ClientEntity.fromDatabase(dbClient).toData();
  }
}
