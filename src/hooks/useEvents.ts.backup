import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert'];
type CalendarEventUpdate = Database['public']['Tables']['calendar_events']['Update'];
export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  useEffect(() => {
    fetchEvents();
    // Set up realtime subscription for cross-window sync
    let channel: any = null;
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
          (payload) => {
            // // console.log('🔄 Event inserted (realtime):', payload.new);
            setEvents(prev => {
              // Prevent duplicates - only add if not already in state
              const exists = prev.some(e => e.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as CalendarEvent];
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
          (payload) => {
            // // console.log('🔄 Event updated (realtime):', payload.new);
            setEvents(prev => 
              prev.map(event => event.id === payload.new.id ? payload.new as CalendarEvent : event)
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
          (payload) => {
            // // console.log('🔄 Event deleted (realtime):', payload.old);
            setEvents(prev => prev.filter(event => event.id !== payload.old.id));
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
  }, []);
  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const addEvent = async (eventData: Omit<CalendarEventInsert, 'user_id'>, options?: { silent?: boolean }): Promise<CalendarEvent> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ addEvent: User not authenticated');
        throw new Error('User not authenticated');
      }
      // // console.log('🔍 addEvent: Creating event in database:', {
        // title: eventData.title,
        // event_type: eventData.event_type,
        // user_id: user.id
      // });
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{ ...eventData, user_id: user.id }])
        .select()
        .single();
      if (error) {
        console.error('❌ addEvent: Database insert error:', error);
        throw error;
      }
      if (!data) {
        console.error('❌ addEvent: No data returned from insert');
        throw new Error('No data returned from event creation');
      }
      // // console.log('✅ addEvent: Event created successfully:', {
        // id: data.id,
        // title: data.title,
        // event_type: data.event_type
      // });
      setEvents(prev => [...prev, data]);
      // Only show toast if not silent
      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Event created successfully",
        });
      }
      return data;
    } catch (error) {
      console.error('❌ addEvent: Fatal error:', error);
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
  const updateEvent = async (id: string, updates: CalendarEventUpdate, options?: { silent?: boolean }) => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setEvents(prev => prev.map(event => event.id === id ? data : event));
      // Only show toast if not silent
      if (!options?.silent) {
        toast({
          title: "Success",
          description: "Event updated successfully",
        });
      }
      return data;
    } catch (error) {
      console.error('Error updating event:', error);
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
      console.error('Error deleting event:', error);
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