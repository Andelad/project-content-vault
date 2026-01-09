/**
 * useLabels Hook - Phase 5B
 * 
 * React hook for managing label entities and project-label associations.
 * Provides CRUD operations and real-time synchronization via Supabase.
 * 
 * @module useLabels
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/infrastructure/database/client';
import { Label } from '@/shared/types/core';
import { useToast } from '@/presentation/hooks/ui/use-toast';
import { LabelRules } from '@/domain/rules/clients/LabelValidation';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { Label as LabelEntity } from '@/domain/entities/Label';

export interface UseLabelsReturn {
  labels: Label[];
  loading: boolean;
  error: Error | null;
  addLabel: (labelData: Partial<Label>) => Promise<Label | null>;
  updateLabel: (id: string, updates: Partial<Label>) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
  addLabelToProject: (projectId: string, labelId: string) => Promise<void>;
  removeLabelFromProject: (projectId: string, labelId: string) => Promise<void>;
  getProjectLabels: (projectId: string) => Promise<Label[]>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing labels
 */
export function useLabels(): UseLabelsReturn {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  /**
   * Fetch all labels for the current user
   */
  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: fetchError } = await supabase
        .from('labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      // Convert database rows to Label entities then to plain objects
      const mappedLabels: Label[] = (data || []).map(row => 
        LabelEntity.fromDatabase(row).toData()
      );

      setLabels(mappedLabels);
    } catch (err) {
      const error = err as Error;
      setError(error);
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error fetching labels:' });
      toast({
        title: 'Error loading labels',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Add a new label
   */
  const addLabel = async (labelData: Partial<Label>): Promise<Label | null> => {
    try {
      // Validate label data before submission
      const validation = LabelRules.validateLabel(labelData);
      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: validation.errors.join(', '),
          variant: 'destructive',
        });
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: insertError } = await supabase
        .from('labels')
        .insert([{
          user_id: user.id,
          name: labelData.name,
          color: labelData.color || '#6B7280',
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const newLabel: Label = LabelEntity.fromDatabase(data).toData();

      setLabels(prev => [...prev, newLabel]);

      toast({
        title: 'Label created',
        description: `Label "${newLabel.name}" has been added successfully.`,
      });

      return LabelEntity.fromDatabase(data);
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error adding label:' });
      toast({
        title: 'Error creating label',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  /**
   * Update an existing label
   */
  const updateLabel = async (id: string, updates: Partial<Label>): Promise<void> => {
    try {
      // Validate updates before submission
      const validation = LabelRules.validateLabel(updates);
      if (!validation.isValid) {
        toast({
          title: 'Validation Error',
          description: validation.errors.join(', '),
          variant: 'destructive',
        });
        throw new Error(validation.errors.join(', '));
      }

      const { error: updateError } = await supabase
        .from('labels')
        .update({
          name: updates.name,
          color: updates.color,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setLabels(prev =>
        prev.map(label =>
          label.id === id
            ? { ...label, ...updates, updatedAt: new Date() }
            : label
        )
      );

      toast({
        title: 'Label updated',
        description: 'Changes saved successfully.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error updating label:' });
      toast({
        title: 'Error updating label',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Delete a label
   * Automatically removes all project-label associations
   */
  const deleteLabel = async (id: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('labels')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setLabels(prev => prev.filter(label => label.id !== id));

      toast({
        title: 'Label deleted',
        description: 'Label has been removed successfully.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error deleting label:' });
      toast({
        title: 'Error deleting label',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Add a label to a project
   */
  const addLabelToProject = async (projectId: string, labelId: string): Promise<void> => {
    try {
      const { error: insertError } = await supabase
        .from('project_labels')
        .insert([{
          project_id: projectId,
          label_id: labelId,
        }]);

      if (insertError) {
        // Ignore duplicate key errors (already associated)
        if (insertError.code !== '23505') {
          throw insertError;
        }
      }

      toast({
        title: 'Label added',
        description: 'Label has been added to the project.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error adding label to project:' });
      toast({
        title: 'Error adding label',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Remove a label from a project
   */
  const removeLabelFromProject = async (projectId: string, labelId: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from('project_labels')
        .delete()
        .eq('project_id', projectId)
        .eq('label_id', labelId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Label removed',
        description: 'Label has been removed from the project.',
      });
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error removing label from project:' });
      toast({
        title: 'Error removing label',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  /**
   * Get all labels for a specific project
   */
  const getProjectLabels = async (projectId: string): Promise<Label[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('project_labels')
        .select(`
          label_id,
          labels (*)
        `)
        .eq('project_id', projectId);

      if (fetchError) throw fetchError;

      // Map to Label objects
      type ProjectLabelRow = {
        label_id: string;
        labels: {
          id: string;
          name: string;
          color: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
      };

      const projectLabels: Label[] = (data as ProjectLabelRow[] | null || [])
        .filter((row): row is ProjectLabelRow => Boolean(row.labels))
        .map(row => {
          const labelData = row.labels;
          return LabelEntity.fromDatabase(labelData).toData();
        });

      return projectLabels;
    } catch (err) {
      const error = err as Error;
      ErrorHandlingService.handle(error, { source: 'useLabels', action: 'Error fetching project labels:' });
      return [];
    }
  };

  // Fetch labels on mount
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return {
    labels,
    loading,
    error,
    addLabel,
    updateLabel,
    deleteLabel,
    addLabelToProject,
    removeLabelFromProject,
    getProjectLabels,
    refetch: fetchLabels,
  };
}
