import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
// Note: Database types still use 'milestones' key but table is now 'phases'
// TODO: After types regenerate, update to use 'phases' key
type Milestone = Database['public']['Tables']['phases']['Row'];
type MilestoneInsert = Database['public']['Tables']['phases']['Insert'];
type MilestoneUpdate = Database['public']['Tables']['phases']['Update'];

type CamelMilestoneInsert = {
  projectId?: string;
  dueDate?: string | Date;
  timeAllocation?: number;
  timeAllocationHours?: number;
  startDate?: string | Date;
  isRecurring?: boolean;
  recurringConfig?: Milestone['recurring_config'];
};

type MilestoneInput = Omit<MilestoneInsert, 'user_id'> & CamelMilestoneInsert;

const toIsoString = (value?: string | Date | null): string | null | undefined => {
  if (value instanceof Date) return value.toISOString();
  return value;
};
export function useMilestones(projectId?: string) {
  const [phases, setPhases] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchMilestones = useCallback(async (targetProjectId: string) => {
    try {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', targetProjectId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error fetching milestones:' });
      toast({
        title: "Error",
        description: "Failed to load milestones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  const fetchAllMilestones = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error fetching all milestones:' });
      toast({
        title: "Error",
        description: "Failed to load milestones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
  }, [projectId, fetchAllMilestones, fetchMilestones]);
  const addMilestone = async (milestoneData: MilestoneInput, options: { silent?: boolean } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      // Transform camelCase to snake_case for database insertion
      const dbMilestoneData: MilestoneInsert = {
        user_id: user.id,
        name: milestoneData.name,
        project_id: milestoneData.projectId ?? milestoneData.project_id,
        due_date: toIsoString(milestoneData.dueDate ?? milestoneData.due_date),
        time_allocation: milestoneData.timeAllocation ?? milestoneData.time_allocation,
        time_allocation_hours: milestoneData.timeAllocationHours ?? milestoneData.timeAllocation ?? milestoneData.time_allocation,
      };
      // Add optional fields if provided
      if (milestoneData.startDate || milestoneData.start_date) {
        const startDateValue = milestoneData.startDate || milestoneData.start_date;
        dbMilestoneData.start_date = toIsoString(startDateValue);
      }
      if (milestoneData.isRecurring !== undefined || milestoneData.is_recurring !== undefined) {
        dbMilestoneData.is_recurring = milestoneData.isRecurring ?? milestoneData.is_recurring;
      }
      if (milestoneData.recurringConfig || milestoneData.recurring_config) {
        dbMilestoneData.recurring_config = milestoneData.recurringConfig || milestoneData.recurring_config;
      }
      const { data, error } = await supabase
        .from('phases')
        .insert(dbMilestoneData)
        .select()
        .single();
      if (error) {
        ErrorHandlingService.handle(error, { source: 'useMilestones', action: '[useMilestones] Database error:' });
        throw error;
      }
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
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error adding milestone:' });
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
        .from('phases')
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
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error updating milestone:' });
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
      // First, fetch the milestone to check if it's a recurring template
      const phase = milestones.find(m => m.id === id);
      if (milestone?.is_recurring === true) {
        // This is a recurring template - delete all numbered instances first
        // Numbered instances have names like "Sprint 1", "Sprint 2", etc.
        const baseName = milestone.name;
        const numberedPattern = `${baseName} `;
        // Delete all numbered instances (name starts with base name + space + number)
        const { error: instancesError } = await supabase
          .from('phases')
          .delete()
          .eq('project_id', milestone.project_id)
          .eq('is_recurring', false)
          .like('name', `${numberedPattern}%`);
        if (instancesError) {
          ErrorHandlingService.handle(instancesError, { source: 'useMilestones', action: '[useMilestones] Error deleting milestone instances:' });
          throw instancesError;
        }
        // Update local state to remove numbered instances
        setMilestones(prev => prev.filter(m => 
          !(m.project_id === milestone.project_id && 
            m.is_recurring === false && 
            m.name.startsWith(numberedPattern))
        ));
      }
      // Then delete the milestone itself
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', id);
      if (error) {
        ErrorHandlingService.handle(error, { source: 'useMilestones', action: '[useMilestones] Error deleting milestone:' });
        throw error;
      }
      setMilestones(prev => prev.filter(m => m.id !== id));
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Milestone deleted successfully",
        });
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: '[useMilestones] Error deleting milestone:' });
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
