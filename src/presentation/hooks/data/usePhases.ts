import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/infrastructure/database/client';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import type { Database, Json } from '@/infrastructure/database/types';
import type { PhaseDTO } from '@/shared/types/core';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { Phase as PhaseEntity } from '@/domain/entities/Phase';
// Note: Database table is now 'phases' but table is now 'phases'
// TODO: After types regenerate, update to use 'phases' key
type Milestone = Database['public']['Tables']['phases']['Row'];
type MilestoneInsert = Database['public']['Tables']['phases']['Insert'];
type PhaseUpdate = Database['public']['Tables']['phases']['Update'];

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

type PhaseInput = Omit<MilestoneInsert, 'user_id'> & CamelMilestoneInsert;

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
  const fetchPhases = useCallback(async (targetProjectId: string) => {
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
  const fetchAllPhases = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('phases')
        .select('*')
        .order('end_date', { ascending: true });
      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'usePhases', action: 'Error fetching all phases:' });
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
      fetchPhases(projectId);
    } else {
      fetchAllPhases();
    }
    // Cleanup timeout on unmount
    return () => {
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
    };
  }, [projectId, fetchAllPhases, fetchPhases]);
  const addPhase = async (phaseData: PhaseInput, options: { silent?: boolean } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Support both endDate and dueDate (dueDate is deprecated but still used in some places)
      const endDateIso = toIsoString(phaseData.endDate || phaseData.end_date || phaseData.dueDate);
      const startDateValue = phaseData.startDate || phaseData.start_date;
      const startDateIso = startDateValue ? toIsoString(startDateValue) : endDateIso;
      
      // Transform camelCase to snake_case for database insertion
      const dbPhaseData: MilestoneInsert = {
        user_id: user.id,
        name: phaseData.name,
        project_id: phaseData.projectId ?? phaseData.project_id,
        end_date: endDateIso!,
        start_date: startDateIso!,
        time_allocation: phaseData.timeAllocation ?? phaseData.time_allocation,
        time_allocation_hours: phaseData.timeAllocationHours ?? phaseData.timeAllocation ?? phaseData.time_allocation,
      };
      if (phaseData.isRecurring !== undefined || phaseData.is_recurring !== undefined) {
        dbPhaseData.is_recurring = phaseData.isRecurring ?? phaseData.is_recurring;
      }
      if (phaseData.recurringConfig || phaseData.recurring_config) {
        dbPhaseData.recurring_config = (phaseData.recurringConfig || phaseData.recurring_config) as Json;
      }
      const { data, error } = await supabase
        .from('phases')
        .insert(dbPhaseData)
        .select()
        .single();
      if (error) {
        ErrorHandlingService.handle(error, { source: 'usePhases', action: '[usePhases] Database error:' });
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
      ErrorHandlingService.handle(error, { source: 'usePhases', action: 'Error adding phase:' });
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to create phase",
        variant: "destructive",
      });
      throw error;
    }
  };
  const updatePhase = async (id: string, updates: PhaseUpdate, options: { silent?: boolean } = {}) => {
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
      ErrorHandlingService.handle(error, { source: 'usePhases', action: 'Error updating phase:' });
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
      // First, fetch the phase to check if it's a recurring template
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
          ErrorHandlingService.handle(instancesError, { source: 'usePhases', action: '[usePhases] Error deleting phase instances:' });
          throw instancesError;
        }
        // Update local state to remove numbered instances
        setPhases(prev => prev.filter(p => 
          !(p.project_id === phase.project_id && 
            p.is_recurring === false && 
            p.name.startsWith(numberedPattern))
        ));
      }
      // Then delete the phase itself
      const { error } = await supabase
        .from('phases')
        .delete()
        .eq('id', id);
      if (error) {
        ErrorHandlingService.handle(error, { source: 'usePhases', action: '[usePhases] Error deleting phase:' });
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
      ErrorHandlingService.handle(error, { source: 'usePhases', action: '[usePhases] Error deleting phase:' });
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
    refetch: projectId ? () => fetchPhases(projectId) : fetchAllPhases
  };
}
