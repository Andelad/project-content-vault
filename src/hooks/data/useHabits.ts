import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { OKLCH_HABIT_BROWN } from '@/constants/colors';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert'];
type CalendarEventUpdate = Database['public']['Tables']['calendar_events']['Update'];

const HABIT_BROWN_COLOR = OKLCH_HABIT_BROWN; // Brown color for habits

export function useHabits() {
  const [habits, setHabits] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHabits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('category', 'habit')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setHabits(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHabits', action: 'Error fetching habits:' });
      toast({
        title: "Error",
        description: "Failed to load habits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHabits();

    // Set up realtime subscription for cross-window sync
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('habits_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calendar_events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            // Only handle habit inserts
            if ((payload.new as CalendarEvent).category === 'habit') {
              setHabits(prev => {
                const exists = prev.some(h => h.id === payload.new.id);
                if (exists) return prev;
                return [...prev, payload.new as CalendarEvent];
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'calendar_events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updated = payload.new as CalendarEvent;
            // Handle habit updates or conversion to/from habit
            if (updated.category === 'habit') {
              setHabits(prev => {
                const exists = prev.some(h => h.id === updated.id);
                if (exists) {
                  return prev.map(habit => habit.id === updated.id ? updated : habit);
                } else {
                  return [...prev, updated];
                }
              });
            } else {
              // Remove if it's no longer a habit
              setHabits(prev => prev.filter(habit => habit.id !== updated.id));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'calendar_events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setHabits(prev => prev.filter(habit => habit.id !== payload.old.id));
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchHabits]);

  const addHabit = async (
    habitData: Omit<CalendarEventInsert, 'user_id' | 'category' | 'project_id'>, 
    options?: { silent?: boolean }
  ): Promise<CalendarEvent> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Ensure habit-specific defaults
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ 
          ...habitData, 
          user_id: user.id,
          category: 'habit',
          project_id: null, // Habits don't have projects
          color: HABIT_BROWN_COLOR // Always brown
        }])
        .select()
        .single();

      if (error) {
        ErrorHandlingService.handle(error, { source: 'useHabits', action: '❌ addHabit: Database insert error:' });
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from habit creation');
      }

      setHabits(prev => [...prev, data]);

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Habit created successfully",
        });
      }

      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHabits', action: '❌ addHabit: Fatal error:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to create habit",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const updateHabit = async (
    id: string, 
    updates: Omit<CalendarEventUpdate, 'category' | 'project_id'>, 
    options?: { silent?: boolean }
  ) => {
    try {
      // Ensure habits remain habits with no project
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ 
          ...updates, 
          category: 'habit',
          project_id: null,
          color: HABIT_BROWN_COLOR 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setHabits(prev => prev.map(habit => habit.id === id ? data : habit));

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Habit updated successfully",
        });
      }

      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHabits', action: 'Error updating habit:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to update habit",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const deleteHabit = async (id: string, options?: { silent?: boolean }) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('category', 'habit'); // Safety check

      if (error) throw error;

      setHabits(prev => prev.filter(habit => habit.id !== id));

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Habit deleted successfully",
        });
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useHabits', action: 'Error deleting habit:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to delete habit",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  return {
    habits,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    refetch: fetchHabits,
  };
}
