import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/ui/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';
import type { PhaseDTO } from '@/types/core';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { Phase as PhaseEntity } from '@/domain/entities/Phase';
// Note: Database types still use 'milestones' key but table is now 'phases'
// TODO: After types regenerate, update to use 'phases' key
type Milestone = Database['public']['Tables']['phases']['Row'];
type MilestoneInsert = Database['public']['Tables']['phases']['Insert'];
type MilestoneUpdate = Database['public']['Tables']['phases']['Update'];

type CamelMilestoneInsert = {
  projectId?: string;
  dueDate?: string | Date;
  endDate?: string | Date;
  timeAllocation?: number;
  timeAllocationHours?: number;
  startDate?: string | Date;
  isRecurring?: boolean;
  recurringConfig?: PhaseDTO['recurringConfig'];
};

type MilestoneInput = Omit<MilestoneInsert, 'user_id'> & CamelMilestoneInsert;

const toIsoString = (value?: string | Date | null): string | null | undefined => {
  if (value instanceof Date) return value.toISOString();
  return value;
};
export function usePhases(projectId?: string) {
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
        .order('end_date', { ascending: true });
      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'usePhases', action: 'Error fetching phases:' });
      toast({
        title: "Error",
        description: "Failed to load phases",
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
        .order('end_date', { ascending: true });
      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error fetching all milestones:' });
      toast({
        title: "Error",
        description: "Failed to load phases",
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
  const addPhase = async (milestoneData: MilestoneInput, options: { silent?: boolean } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Support both endDate and dueDate (dueDate is deprecated but still used in some places)
      const endDateIso = toIsoString(milestoneData.endDate || milestoneData.end_date || milestoneData.dueDate);
      const startDateValue = milestoneData.startDate || milestoneData.start_date;
      const startDateIso = startDateValue ? toIsoString(startDateValue) : endDateIso;
      
      // Transform camelCase to snake_case for database insertion
      const dbMilestoneData: MilestoneInsert = {
        user_id: user.id,
        name: milestoneData.name,
        project_id: milestoneData.projectId ?? milestoneData.project_id,
        end_date: endDateIso!,
        start_date: startDateIso!,
        time_allocation: milestoneData.timeAllocation ?? milestoneData.time_allocation,
        time_allocation_hours: milestoneData.timeAllocationHours ?? milestoneData.timeAllocation ?? milestoneData.time_allocation,
      };
      if (milestoneData.isRecurring !== undefined || milestoneData.is_recurring !== undefined) {
        dbMilestoneData.is_recurring = milestoneData.isRecurring ?? milestoneData.is_recurring;
      }
      if (milestoneData.recurringConfig || milestoneData.recurring_config) {
        dbMilestoneData.recurring_config = (milestoneData.recurringConfig || milestoneData.recurring_config) as Json;
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
      // Insert locally and sort by end_date
      setPhases(prev => [...prev, data].sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Phase created successfully",
        });
      }
      
      return PhaseEntity.fromDatabase(data);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error adding milestone:' });
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to create phase",
        variant: "destructive",
      });
      throw error;
    }
  };
  const updatePhase = async (id: string, updates: MilestoneUpdate, options: { silent?: boolean } = {}) => {
    try {
      const { data, error } = await supabase
        .from('phases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setPhases(prev => prev.map(phase => 
        phase.id === id ? data : phase
      ).sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()));
  // Only show toast if not in silent mode
      if (!options.silent) {
        // Debounce success toast
        if (updateToastTimeoutRef.current) {
          clearTimeout(updateToastTimeoutRef.current);
        }
        updateToastTimeoutRef.current = setTimeout(() => {
          toast({
            title: "Success",
            description: "Phase updated successfully",
          });
          }, 500);
      }
      
      return PhaseEntity.fromDatabase(data);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: 'Error updating milestone:' });
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to update phase",
        variant: "destructive",
      });
      throw error;
    }
  };
  const showSuccessToast = (message: string = "Phase updated successfully") => {
    toast({
      title: "Success",
      description: message,
    });
  };
  const deletePhase = async (id: string, options: { silent?: boolean } = {}) => {
    try {
      // First, fetch the milestone to check if it's a recurring template
      const phase = phases.find(p => p.id === id);
      if (phase?.is_recurring === true) {
        // This is a recurring template - delete all numbered instances first
        // Numbered instances have names like "Sprint 1", "Sprint 2", etc.
        const baseName = phase.name;
        const numberedPattern = `${baseName} `;
        // Delete all numbered instances (name starts with base name + space + number)
        const { error: instancesError } = await supabase
          .from('phases')
          .delete()
          .eq('project_id', phase.project_id)
          .eq('is_recurring', false)
          .like('name', `${numberedPattern}%`);
        if (instancesError) {
          ErrorHandlingService.handle(instancesError, { source: 'useMilestones', action: '[useMilestones] Error deleting milestone instances:' });
          throw instancesError;
        }
        // Update local state to remove numbered instances
        setPhases(prev => prev.filter(p => 
          !(p.project_id === phase.project_id && 
            p.is_recurring === false && 
            p.name.startsWith(numberedPattern))
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
      setPhases(prev => prev.filter(p => p.id !== id));
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Phase deleted successfully",
        });
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useMilestones', action: '[useMilestones] Error deleting milestone:' });
      // Always show error toasts
      toast({
        title: "Error",
        description: "Failed to delete phase",
        variant: "destructive",
      });
      throw error;
    }
  };
  return {
    phases,
    loading,
    addPhase,
    updatePhase,
    deletePhase,
    showSuccessToast,
    refetch: projectId ? () => fetchMilestones(projectId) : fetchAllMilestones
  };
}
