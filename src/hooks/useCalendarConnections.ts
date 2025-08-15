import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row'];
type CalendarConnectionInsert = Database['public']['Tables']['calendar_connections']['Insert'];
type CalendarConnectionUpdate = Database['public']['Tables']['calendar_connections']['Update'];

type ImportHistory = Database['public']['Tables']['calendar_import_history']['Row'];

export function useCalendarConnections() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnections();
    fetchImportHistory();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching calendar connections:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setImportHistory(data || []);
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  };

  const addConnection = async (connectionData: Omit<CalendarConnectionInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('calendar_connections')
        .insert([{ ...connectionData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setConnections(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Calendar connection added successfully",
      });
      return data;
    } catch (error) {
      console.error('Error adding calendar connection:', error);
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
      console.error('Error updating calendar connection:', error);
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
      console.error('Error deleting calendar connection:', error);
      toast({
        title: "Error",
        description: "Failed to delete calendar connection",
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
    refetch: () => {
      fetchConnections();
      fetchImportHistory();
    },
  };
}