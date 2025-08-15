import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Holiday = Database['public']['Tables']['holidays']['Row'];
type HolidayInsert = Database['public']['Tables']['holidays']['Insert'];
type HolidayUpdate = Database['public']['Tables']['holidays']['Update'];

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast({
        title: "Error",
        description: "Failed to load holidays",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (holidayData: Omit<HolidayInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('holidays')
        .insert([{ ...holidayData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setHolidays(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Holiday created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast({
        title: "Error",
        description: "Failed to create holiday",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateHoliday = async (id: string, updates: HolidayUpdate) => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setHolidays(prev => prev.map(holiday => holiday.id === id ? data : holiday));
      toast({
        title: "Success",
        description: "Holiday updated successfully",
      });
      return data;
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast({
        title: "Error",
        description: "Failed to update holiday",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setHolidays(prev => prev.filter(holiday => holiday.id !== id));
      toast({
        title: "Success",
        description: "Holiday deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast({
        title: "Error",
        description: "Failed to delete holiday",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    holidays,
    loading,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    refetch: fetchHolidays,
  };
}