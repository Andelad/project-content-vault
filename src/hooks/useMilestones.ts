import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Milestone = Database['public']['Tables']['milestones']['Row'];
type MilestoneInsert = Database['public']['Tables']['milestones']['Insert'];
type MilestoneUpdate = Database['public']['Tables']['milestones']['Update'];

export function useMilestones(projectId?: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchMilestones(projectId);
    } else {
      fetchAllMilestones();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
    };
  }, [projectId]);

  const fetchMilestones = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      toast({
        title: "Error",
        description: "Failed to load milestones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error('Error fetching all milestones:', error);
      toast({
        title: "Error",
        description: "Failed to load milestones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addMilestone = async (milestoneData: Omit<MilestoneInsert, 'user_id'>, options: { silent?: boolean } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('milestones')
        .insert({
        user_id: user.id,
        ...milestoneData,
      })
        .select()
        .single();

      if (error) throw error;
      // Insert locally and sort by due_date
      setMilestones(prev => [...prev, data].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Milestone created successfully",
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error adding milestone:', error);
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to create milestone",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateMilestone = async (id: string, updates: MilestoneUpdate, options: { silent?: boolean } = {}) => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setMilestones(prev => prev.map(milestone => 
        milestone.id === id ? data : milestone
      ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
      
  // Only show toast if not in silent mode
      if (!options.silent) {
        // Debounce success toast
        if (updateToastTimeoutRef.current) {
          clearTimeout(updateToastTimeoutRef.current);
        }
        
        updateToastTimeoutRef.current = setTimeout(() => {
          toast({
            title: "Success",
            description: "Milestone updated successfully",
          });
        }, 500);
      }
      
      return data;
    } catch (error) {
      console.error('Error updating milestone:', error);
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to update milestone",
        variant: "destructive",
      });
      throw error;
    }
  };

  const showSuccessToast = (message: string = "Milestone updated successfully") => {
    toast({
      title: "Success",
      description: message,
    });
  };

  const deleteMilestone = async (id: string, options: { silent?: boolean } = {}) => {
    try {
      const { error } = await supabase
        .from('milestones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMilestones(prev => prev.filter(milestone => milestone.id !== id));
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Milestone deleted successfully",
        });
      }
    } catch (error) {
      console.error('Error deleting milestone:', error);
      // Always show error toasts
      toast({
        title: "Error",
        description: "Failed to delete milestone",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    milestones,
    loading,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    showSuccessToast,
    refetch: projectId ? () => fetchMilestones(projectId) : fetchAllMilestones
  };
}
