import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

type HolidayRow = Database['public']['Tables']['holidays']['Row'];
type HolidayInsert = Database['public']['Tables']['holidays']['Insert'];
type HolidayUpdate = Database['public']['Tables']['holidays']['Update'];

// UI-friendly Holiday type (camelCase)
export interface Holiday {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedHolidayRef = useRef<string | null>(null);

  // Helper: parse a YYYY-MM-DD string as a LOCAL date at midnight
  const parseLocalDate = (yyyyMmDd: string): Date => {
    // Expect format YYYY-MM-DD
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    // Construct Date in local timezone at midnight
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  };

  // Helper: format a Date to YYYY-MM-DD using LOCAL components
  const formatLocalDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    fetchHolidays();
    
    // Cleanup timeout on unmount
    return () => {
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
    };
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      
      // Transform snake_case to camelCase for UI
      const transformedData = (data || []).map(holiday => ({
        id: holiday.id,
        title: holiday.title,
        // Parse as local calendar days to avoid UTC shifts
        startDate: parseLocalDate(holiday.start_date as unknown as string),
        endDate: parseLocalDate(holiday.end_date as unknown as string),
        notes: holiday.notes,
        created_at: holiday.created_at,
        updated_at: holiday.updated_at,
        user_id: holiday.user_id
      }));
      
      setHolidays(transformedData);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHolidays', action: 'Error fetching holidays:' });
      toast({
        title: "Error",
        description: "Failed to load holidays",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (holidayData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Transform camelCase to snake_case for database
      const dbHolidayData = {
        title: holidayData.title,
        // Use LOCAL date components when persisting calendar-only dates
        start_date: holidayData.startDate instanceof Date 
          ? formatLocalDate(holidayData.startDate)
          : holidayData.startDate,
        end_date: holidayData.endDate instanceof Date 
          ? formatLocalDate(holidayData.endDate)
          : holidayData.endDate,
        notes: holidayData.notes || null,
        user_id: user.id
      };

      const { data, error } = await supabase
        .from('holidays')
        .insert([dbHolidayData])
        .select()
        .single();

      if (error) throw error;
      
      // Transform database response to camelCase for UI consistency
      const transformedData = {
        id: data.id,
        title: data.title,
        startDate: parseLocalDate(data.start_date as unknown as string),
        endDate: parseLocalDate(data.end_date as unknown as string),
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id
      };
      
      setHolidays(prev => [...prev, transformedData]);
      toast({
        title: "Success",
        description: "Holiday created successfully",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHolidays', action: 'Error adding holiday:' });
      toast({
        title: "Error",
        description: "Failed to create holiday",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateHoliday = async (id: string, updates: any, options: { silent?: boolean } = {}) => {
    try {
      // Transform camelCase to snake_case for database if needed
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.startDate !== undefined) {
        dbUpdates.start_date = updates.startDate instanceof Date 
          ? formatLocalDate(updates.startDate)
          : updates.startDate;
      }
      if (updates.endDate !== undefined) {
        dbUpdates.end_date = updates.endDate instanceof Date 
          ? formatLocalDate(updates.endDate)
          : updates.endDate;
      }
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      const { data, error } = await supabase
        .from('holidays')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Transform database response to camelCase for UI consistency
      const transformedData = {
        id: data.id,
        title: data.title,
        startDate: parseLocalDate(data.start_date as unknown as string),
        endDate: parseLocalDate(data.end_date as unknown as string),
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id
      };
      
      // CRITICAL FIX: Don't update local state during drag operations (silent mode)
      // The visual feedback during drag is handled by dragState in HolidayBar.tsx
      // Updating state here would overwrite the drag visual offset, causing "ping back"
      if (!options.silent) {
        setHolidays(prev => prev.map(holiday => holiday.id === id ? transformedData : holiday));
      }
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        // Debounce success toast to prevent spam during drag operations
        lastUpdatedHolidayRef.current = id;
        if (updateToastTimeoutRef.current) {
          clearTimeout(updateToastTimeoutRef.current);
        }
        
        updateToastTimeoutRef.current = setTimeout(() => {
          // Only show toast if this was the last holiday updated
          if (lastUpdatedHolidayRef.current === id) {
            toast({
              title: "Success",
              description: "Holiday updated successfully",
            });
          }
        }, 500); // 500ms debounce delay
      }
      
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHolidays', action: 'Error updating holiday:' });
      // Clear any pending success toast when there's an error
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
        updateToastTimeoutRef.current = null;
      }
      // Always show error toasts
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
      ErrorHandlingService.handle(error, { source: 'useHolidays', action: 'Error deleting holiday:' });
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