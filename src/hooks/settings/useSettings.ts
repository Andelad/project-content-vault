import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';

type Settings = Database['public']['Tables']['settings']['Row'];
type SettingsUpdate = Database['public']['Tables']['settings']['Update'];

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const createDefaultSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const defaultSettings = {
        user_id: user.id,
        weekly_work_hours: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: []
        }
      };

      const { data, error } = await supabase
        .from('settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useSettings', action: 'Error creating default settings:' });
      throw error;
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      // If no settings found, create default settings
      if (!data) {
        await createDefaultSettings();
      } else {
        setSettings(data);
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useSettings', action: 'Error fetching settings:' });
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [createDefaultSettings, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<SettingsUpdate>) => {
    try {
      if (!settings) {
        await createDefaultSettings();
        return;
      }

      const { data, error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', settings.id)
        .select()
        .single();

      if (error) throw error;
      setSettings(data);
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useSettings', action: 'Error updating settings:' });
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refetch: fetchSettings,
  };
}