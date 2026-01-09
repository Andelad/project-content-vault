import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/infrastructure/database/client';
import { useToast } from '@/hooks/ui/use-toast';
import type { Database } from '@/infrastructure/database/types';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row'];
type CalendarConnectionInsert = Database['public']['Tables']['calendar_connections']['Insert'];
type CalendarConnectionUpdate = Database['public']['Tables']['calendar_connections']['Update'];

type ImportHistory = Database['public']['Tables']['calendar_import_history']['Row'];

export function useCalendarConnections() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConnections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error fetching calendar connections:' });
      toast({
        title: "Error",
        description: "Failed to load calendar connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchImportHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setImportHistory(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error fetching import history:' });
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchImportHistory();
  }, [fetchConnections, fetchImportHistory]);

  const addConnection = async (connectionData: Omit<CalendarConnectionInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Remove any sensitive token data before storing
      const {
        access_token: _accessToken,
        refresh_token: _refreshToken,
        ...safeConnectionData
      } = connectionData as CalendarConnectionInsert & {
        access_token?: string | null;
        refresh_token?: string | null;
      };

      const { data, error } = await supabase
        .from('calendar_connections')
        .insert([{ 
          ...safeConnectionData, 
          user_id: user.id,
          connection_status: 'disconnected' // Will be updated via secure OAuth flow
        }])
        .select()
        .single();

      if (error) throw error;
      setConnections(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Calendar connection created. Please complete OAuth authentication.",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error adding calendar connection:' });
      toast({
        title: "Error",
        description: "Failed to add calendar connection",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateConnection = async (id: string, updates: CalendarConnectionUpdate) => {
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setConnections(prev => prev.map(conn => conn.id === id ? data : conn));
      toast({
        title: "Success",
        description: "Calendar connection updated successfully",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error updating calendar connection:' });
      toast({
        title: "Error",
        description: "Failed to update calendar connection",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteConnection = async (id: string) => {
    try {
      const { error } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setConnections(prev => prev.filter(conn => conn.id !== id));
      toast({
        title: "Success",
        description: "Calendar connection deleted successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error deleting calendar connection:' });
      toast({
        title: "Error",
        description: "Failed to delete calendar connection",
        variant: "destructive",
      });
      throw error;
    }
  };

  const authenticateConnection = async (connectionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      // Call secure edge function for OAuth handling
      const { data, error } = await supabase.functions.invoke('calendar-oauth', {
        body: { 
          connection_id: connectionId,
          action: 'authenticate'
        }
      });

      if (error) throw error;
      
      await fetchConnections(); // Refresh to show updated status
      toast({
        title: "Success",
        description: "Calendar connection authenticated successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error authenticating connection:' });
      toast({
        title: "Error",
        description: "Failed to authenticate calendar connection",
        variant: "destructive",
      });
      throw error;
    }
  };

  const revokeConnection = async (connectionId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      // Call secure edge function to revoke tokens
      const { data, error } = await supabase.functions.invoke('calendar-oauth', {
        method: 'DELETE',
        body: { 
          connection_id: connectionId,
          action: 'revoke_tokens'
        }
      });

      if (error) throw error;
      
      await fetchConnections(); // Refresh to show updated status
      toast({
        title: "Success",
        description: "Calendar connection revoked successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useCalendarConnections', action: 'Error revoking connection:' });
      toast({
        title: "Error",
        description: "Failed to revoke calendar connection",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    connections,
    importHistory,
    loading,
    addConnection,
    updateConnection,
    deleteConnection,
    authenticateConnection,
    revokeConnection,
    refetch: () => {
      fetchConnections();
      fetchImportHistory();
    },
  };
}