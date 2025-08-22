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
        .order('order_index', { ascending: true });

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
        .order('order_index', { ascending: true });

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

  const addMilestone = async (milestoneData: Omit<MilestoneInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate the next order index for this project
      const { data: maxOrderData } = await supabase
        .from('milestones')
        .select('order_index')
        .eq('project_id', milestoneData.project_id)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrderIndex = maxOrderData?.[0]?.order_index ? maxOrderData[0].order_index + 1 : 0;

      const { data, error } = await supabase
        .from('milestones')
        .insert([{ 
          ...milestoneData, 
          user_id: user.id,
          order_index: nextOrderIndex 
        }])
        .select()
        .single();

      if (error) throw error;
      setMilestones(prev => [...prev, data].sort((a, b) => a.order_index - b.order_index));
      toast({
        title: "Success",
        description: "Milestone created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error adding milestone:', error);
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
      ).sort((a, b) => a.order_index - b.order_index));
      
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

  const deleteMilestone = async (id: string) => {
    try {
      const { error } = await supabase
        .from('milestones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMilestones(prev => prev.filter(milestone => milestone.id !== id));
      toast({
        title: "Success",
        description: "Milestone deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      toast({
        title: "Error",
        description: "Failed to delete milestone",
        variant: "destructive",
      });
      throw error;
    }
  };

  const reorderMilestones = async (projectId: string, fromIndex: number, toIndex: number) => {
    try {
      const projectMilestones = milestones.filter(m => m.project_id === projectId);
      const reorderedMilestones = [...projectMilestones];
      const [movedMilestone] = reorderedMilestones.splice(fromIndex, 1);
      reorderedMilestones.splice(toIndex, 0, movedMilestone);

      // Update order indexes
      const updates = reorderedMilestones.map((milestone, index) => ({
        id: milestone.id,
        order_index: index
      }));

      // Update all milestones with new order
      const updatePromises = updates.map(({ id, order_index }) =>
        supabase
          .from('milestones')
          .update({ order_index })
          .eq('id', id)
      );

      await Promise.all(updatePromises);

      // Update local state
      setMilestones(prev => prev.map(milestone => {
        const update = updates.find(u => u.id === milestone.id);
        return update ? { ...milestone, order_index: update.order_index } : milestone;
      }).sort((a, b) => a.order_index - b.order_index));

      toast({
        title: "Success",
        description: "Milestones reordered successfully",
      });
    } catch (error) {
      console.error('Error reordering milestones:', error);
      toast({
        title: "Error",
        description: "Failed to reorder milestones",
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
    reorderMilestones,
    showSuccessToast,
    refetch: projectId ? () => fetchMilestones(projectId) : fetchAllMilestones
  };
}
