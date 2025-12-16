import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

type Row = Database['public']['Tables']['rows']['Row'];
type RowInsert = Database['public']['Tables']['rows']['Insert'];
type RowUpdate = Database['public']['Tables']['rows']['Update'];

export function useRows() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRows = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rows')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useRows', action: 'Error fetching rows:' });
      toast({
        title: "Error",
        description: "Failed to load rows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const addRow = async (rowData: Omit<RowInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('rows')
        .insert([{ ...rowData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setRows(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Row created successfully",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useRows', action: 'Error adding row:' });
      toast({
        title: "Error",
        description: "Failed to create row",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateRow = async (id: string, updates: RowUpdate) => {
    try {
      const { data, error } = await supabase
        .from('rows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setRows(prev => prev.map(row => row.id === id ? data : row));
      toast({
        title: "Success",
        description: "Row updated successfully",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useRows', action: 'Error updating row:' });
      toast({
        title: "Error",
        description: "Failed to update row",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteRow = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRows(prev => prev.filter(row => row.id !== id));
      toast({
        title: "Success",
        description: "Row deleted successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useRows', action: 'Error deleting row:' });
      toast({
        title: "Error",
        description: "Failed to delete row",
        variant: "destructive",
      });
      throw error;
    }
  };

  const reorderRows = async (groupId: string, fromIndex: number, toIndex: number) => {
    // For now, just update local state - can implement proper ordering later
    const groupRows = rows.filter(r => r.group_id === groupId);
    const [reorderedRow] = groupRows.splice(fromIndex, 1);
    groupRows.splice(toIndex, 0, reorderedRow);
    
    setRows(prev => [
      ...prev.filter(r => r.group_id !== groupId),
      ...groupRows
    ]);
  };

  return {
    rows,
    loading,
    addRow,
    updateRow,
    deleteRow,
    reorderRows,
    refetch: fetchRows,
  };
}