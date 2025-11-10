/**
 * useClients Hook - Phase 5B
 * 
 * React hook for managing client entities.
 * Coordinates ClientOrchestrator for CRUD operations.
 * 
 * @module useClients
 */

import { useState, useEffect } from 'react';
import { Client } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { ClientOrchestrator } from '@/services/orchestrators/ClientOrchestrator';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: Error | null;
  addClient: (clientData: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing clients
 */
export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  /**
   * Fetch all clients for the current user
   */
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchedClients = await ClientOrchestrator.getAllClients();
      setClients(fetchedClients);
    } catch (err) {
      const error = err as Error;
      setError(error);
      ErrorHandlingService.handle(error, { 
        source: 'useClients', 
        action: 'Error fetching clients' 
      });
      toast({
        title: 'Error loading clients',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a new client
   */
  const addClient = async (clientData: Partial<Client>): Promise<Client | null> => {
    try {
      const result = await ClientOrchestrator.createClientWorkflow(clientData);
      
      if (!result.success) {
        toast({
          title: 'Validation Error',
          description: result.errors?.join(', '),
          variant: 'destructive',
        });
        return null;
      }

      // Refresh clients list
      await fetchClients();

      toast({
        title: 'Client created',
        description: `${result.client?.name} has been added successfully.`,
      });

      return result.client || null;
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { 
        source: 'useClients', 
        action: 'Error adding client' 
      });
      toast({
        title: 'Error creating client',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  /**
   * Update an existing client
   */
  const updateClient = async (id: string, updates: Partial<Client>): Promise<void> => {
    try {
      const result = await ClientOrchestrator.updateClientWorkflow(id, updates);
      
      if (!result.success) {
        toast({
          title: 'Validation Error',
          description: result.errors?.join(', '),
          variant: 'destructive',
        });
        throw new Error(result.errors?.join(', '));
      }

      // Refresh clients list
      await fetchClients();

      toast({
        title: 'Client updated',
        description: 'Changes saved successfully.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { 
        source: 'useClients', 
        action: 'Error updating client' 
      });
      toast({
        title: 'Error updating client',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Delete a client
   * Note: Will fail if client has associated projects (ON DELETE RESTRICT)
   */
  const deleteClient = async (id: string): Promise<void> => {
    try {
      const result = await ClientOrchestrator.deleteClientWorkflow(id);
      
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Delete failed');
      }

      setClients(prev => prev.filter(client => client.id !== id));

      toast({
        title: 'Client deleted',
        description: 'Client has been removed successfully.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { 
        source: 'useClients', 
        action: 'Error deleting client' 
      });
      toast({
        title: 'Error deleting client',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    deleteClient,
    refetch: fetchClients,
  };
}
