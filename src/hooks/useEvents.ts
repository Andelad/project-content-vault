import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert'];
type CalendarEventUpdate = Database['public']['Tables']['calendar_events']['Update'];
export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useEvents', action: 'Error fetching events:' });
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
    // Set up realtime subscription for cross-window sync
    let channel: RealtimeChannel | null = null;
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel('calendar_events_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calendar_events',
            filter: `user_id=eq.${user.id}`
          },
          (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
            const newEvent = payload.new as CalendarEvent | null;
            if (!newEvent?.id) return;
            setEvents(prev => {
              const exists = prev.some(e => e.id === newEvent.id);
              if (exists) return prev;
              return [...prev, newEvent];
            });
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
          (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
            const updatedEvent = payload.new as CalendarEvent | null;
            if (!updatedEvent?.id) return;
            setEvents(prev => 
              prev.map(event => event.id === updatedEvent.id ? updatedEvent : event)
            );
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
          (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
            const deletedEvent = payload.old as Partial<CalendarEvent> | null;
            if (!deletedEvent?.id) return;
            setEvents(prev => prev.filter(event => event.id !== deletedEvent.id));
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
  }, [fetchEvents]);

  const addEvent = async (
    eventData: Omit<CalendarEventInsert, 'user_id'>,
    options?: { silent?: boolean }
  ): Promise<CalendarEvent> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        ErrorHandlingService.handle('❌ addEvent: User not authenticated', { source: 'useEvents' });
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ ...eventData, user_id: user.id }])
        .select()
        .single();

      if (error) {
        ErrorHandlingService.handle(error, { source: 'useEvents', action: '❌ addEvent: Database insert error:' });
        throw error;
      }

      if (!data) {
        ErrorHandlingService.handle('❌ addEvent: No data returned from insert', { source: 'useEvents' });
        throw new Error('No data returned from event creation');
      }

      setEvents(prev => [...prev, data]);

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Event created successfully",
        });
      }

      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useEvents', action: '❌ addEvent: Fatal error:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to create event",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const updateEvent = async (
    id: string,
    updates: CalendarEventUpdate,
    options?: { silent?: boolean }
  ) => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setEvents(prev => prev.map(event => event.id === id ? data : event));

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
      }

      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useEvents', action: 'Error updating event:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to update event",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const deleteEvent = async (id: string, options?: { silent?: boolean }) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEvents(prev => prev.filter(event => event.id !== id));

      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useEvents', action: 'Error deleting event:' });
      if (!options?.silent) {
        toast({
          title: "Error",
          description: "Failed to delete event",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    refetch: fetchEvents,
  };
}