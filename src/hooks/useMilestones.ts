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
        // Prefer due_date ordering to enforce chronological processing; fall back to order_index for ties
        .order('due_date', { ascending: true })
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
        // Global chronological ordering for consistency
        .order('due_date', { ascending: true })
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

  const addMilestone = async (milestoneData: Omit<MilestoneInsert, 'user_id'>, options: { silent?: boolean } = {}) => {
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
      // Insert locally then normalize by due_date order
      setMilestones(prev => [...prev, data].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Milestone created successfully",
        });
      }
      
      // Best-effort: normalize order_index to match due_date sequence for this project
      try {
        await normalizeMilestoneOrders(milestoneData.project_id, { silent: true });
      } catch (e) {
        // Non-fatal; normalization may be run manually later
        console.warn('Milestone order normalization deferred:', e);
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
      
      // After any potential due_date change, normalize order_index for this project
      try {
        await normalizeMilestoneOrders(data.project_id, { silent: true });
      } catch (e) {
        console.warn('Milestone order normalization deferred:', e);
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

  // Normalize order_index so that, per project, it matches chronological due_date order
  const normalizeMilestoneOrders = async (projectId?: string, options: { silent?: boolean } = {}) => {
    try {
      if (projectId) {
        const { data, error } = await supabase
          .from('milestones')
          .select('id, project_id, due_date, order_index')
          .eq('project_id', projectId);
        if (error) throw error;

        const byDate = [...(data || [])].sort((a, b) => {
          const ad = new Date(a.due_date).getTime();
          const bd = new Date(b.due_date).getTime();
          if (ad !== bd) return ad - bd;
          // tie-breaker: existing order_index then id
          if ((a.order_index ?? 0) !== (b.order_index ?? 0)) return (a.order_index ?? 0) - (b.order_index ?? 0);
          return String(a.id).localeCompare(String(b.id));
        });

        // Apply updates where index differs
        const updates = byDate.map((m, idx) => ({ id: m.id, order_index: idx }));
        const changed = updates.filter((u, i) => (data?.find(d => d.id === u.id)?.order_index ?? -1) !== u.order_index);
        await Promise.all(changed.map(u => supabase.from('milestones').update({ order_index: u.order_index }).eq('id', u.id)));

        // Update local state
        setMilestones(prev => prev.map(m => {
          const upd = updates.find(u => u.id === m.id);
          return upd ? { ...m, order_index: upd.order_index } : m;
        }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));

        // Only show toast if not in silent mode
        if (!options.silent) {
          toast({ title: 'Success', description: 'Milestone order normalized' });
        }
        return;
      }

      // Normalize across all projects
      const { data, error } = await supabase
        .from('milestones')
        .select('id, project_id, due_date, order_index');
      if (error) throw error;

      const byProject: Record<string, Array<{ id: string; project_id: string; due_date: string; order_index: number | null }>> = {};
      (data || []).forEach(m => {
        const key = String(m.project_id);
        byProject[key] = byProject[key] || [];
        byProject[key].push(m as any);
      });

      // For each project, sort and update
      for (const [pid, arr] of Object.entries(byProject)) {
        const sorted = arr.sort((a, b) => {
          const ad = new Date(a.due_date).getTime();
          const bd = new Date(b.due_date).getTime();
          if (ad !== bd) return ad - bd;
          if ((a.order_index ?? 0) !== (b.order_index ?? 0)) return (a.order_index ?? 0) - (b.order_index ?? 0);
          return String(a.id).localeCompare(String(b.id));
        });
        const updates = sorted.map((m, idx) => ({ id: m.id, order_index: idx }));
        const changed = updates.filter(u => (arr.find(d => d.id === u.id)?.order_index ?? -1) !== u.order_index);
        await Promise.all(changed.map(u => supabase.from('milestones').update({ order_index: u.order_index }).eq('id', u.id)));
      }

      // Refresh local state
      await fetchAllMilestones();
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({ title: 'Success', description: 'All milestone orders normalized' });
      }
    } catch (error) {
      console.error('Error normalizing milestone orders:', error);
      toast({ title: 'Error', description: 'Failed to normalize milestone orders', variant: 'destructive' });
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
  normalizeMilestoneOrders,
  refetch: projectId ? () => fetchMilestones(projectId) : fetchAllMilestones
  };
}
