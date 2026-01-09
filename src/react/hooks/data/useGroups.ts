import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { Group as GroupEntity } from '@/domain/entities/Group';

type DatabaseGroup = Database['public']['Tables']['groups']['Row'];
type GroupInsert = Database['public']['Tables']['groups']['Insert'];
type GroupUpdate = Database['public']['Tables']['groups']['Update'];

export function useGroups() {
  const [groups, setGroups] = useState<DatabaseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const initializeDefaultGroups = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const defaultGroups = [
        { name: 'Work', user_id: user.id },
        { name: 'Personal', user_id: user.id }
      ];

      const { data, error } = await supabase
        .from('groups')
        .insert(defaultGroups)
        .select();

      if (error) throw error;
      if (data) {
        setGroups(data);
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useGroups', action: 'Error initializing default groups:' });
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setGroups(data || []);
      
      // Initialize default groups if none exist
      if (!data || data.length === 0) {
        await initializeDefaultGroups();
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useGroups', action: 'Error fetching groups:' });
      toast({
        title: "Error",
        description: "Failed to load groups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [initializeDefaultGroups, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const addGroup = async (groupData: Omit<GroupInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('groups')
        .insert([{ ...groupData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      const groupEntity = GroupEntity.fromDatabase(data);
      setGroups(prev => [...prev, data as DatabaseGroup]);
      toast({
        title: "Success",
        description: "Group created successfully",
      });
      return groupEntity;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useGroups', action: 'Error adding group:' });
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateGroup = async (id: string, updates: GroupUpdate) => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const groupEntity = GroupEntity.fromDatabase(data);
      setGroups(prev => prev.map(group => group.id === id ? data as DatabaseGroup : group));
      toast({
        title: "Success",
        description: "Group updated successfully",
      });
      return groupEntity;
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useGroups', action: 'Error updating group:' });
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setGroups(prev => prev.filter(group => group.id !== id));
      toast({
        title: "Success",
        description: "Group deleted successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useGroups', action: 'Error deleting group:' });
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    groups,
    loading,
    addGroup,
    updateGroup,
    deleteGroup,
    refetch: fetchGroups,
  };
}