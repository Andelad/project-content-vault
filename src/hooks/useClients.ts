/**
 * useClients Hook - Phase 5B
 * 
 * React hook for managing client entities.
 * Provides CRUD operations and real-time synchronization via Supabase.
 * 
 * @module useClients
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientStatus } from '@/types/core';
import { useToast } from '@/hooks/use-toast';
import { ClientRules } from '@/domain/rules/ClientRules';

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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      // Map snake_case to camelCase
      const mappedClients: Client[] = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        status: row.status as ClientStatus,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        billingAddress: row.billing_address,
        notes: row.notes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      setClients(mappedClients);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('Error fetching clients:', error);
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
      // Validate client data before submission
      const validation = ClientRules.validateClient(clientData);
      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: validation.errors.join(', '),
          variant: 'destructive',
        });
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert([{
          user_id: user.id,
          name: clientData.name,
          status: clientData.status || 'active',
          contact_email: clientData.contactEmail,
          contact_phone: clientData.contactPhone,
          billing_address: clientData.billingAddress,
          notes: clientData.notes,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const newClient: Client = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        status: data.status as ClientStatus,
        contactEmail: data.contact_email,
        contactPhone: data.contact_phone,
        billingAddress: data.billing_address,
        notes: data.notes,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setClients(prev => [...prev, newClient]);

      toast({
        title: 'Client created',
        description: `${newClient.name} has been added successfully.`,
      });

      return newClient;
    } catch (err) {
      const error = err as Error;
      console.error('Error adding client:', error);
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
      // Validate updates before submission
      const validation = ClientRules.validateClient(updates);
      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: validation.errors.join(', '),
          variant: 'destructive',
        });
        throw new Error(validation.errors.join(', '));
      }

      const { error: updateError } = await supabase
        .from('clients')
        .update({
          name: updates.name,
          status: updates.status,
          contact_email: updates.contactEmail,
          contact_phone: updates.contactPhone,
          billing_address: updates.billingAddress,
          notes: updates.notes,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setClients(prev =>
        prev.map(client =>
          client.id === id
            ? { ...client, ...updates, updatedAt: new Date() }
            : client
        )
      );

      toast({
        title: 'Client updated',
        description: 'Changes saved successfully.',
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error updating client:', error);
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
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (deleteError) {
        // Check if it's a foreign key constraint error
        if (deleteError.code === '23503') {
          throw new Error('Cannot delete client with associated projects. Delete projects first or use cascade delete.');
        }
        throw deleteError;
      }

      setClients(prev => prev.filter(client => client.id !== id));

      toast({
        title: 'Client deleted',
        description: 'Client has been removed successfully.',
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting client:', error);
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
