import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { normalizeProjectColor } from '@/utils/normalizeProjectColor';
import { Project } from '@/types/core';
import type { Database } from '@/integrations/supabase/types';
import { ProjectOrchestrator } from '@/services/orchestrators/ProjectOrchestrator';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

type SupabaseProjectInsert = Database['public']['Tables']['projects']['Insert'];
type SupabaseProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectToastOptions = { silent?: boolean };

export type AddProjectInput = {
  name: string;
  client?: string;
  clientId?: string;
  startDate: Date | string;
  endDate: Date | string;
  estimatedHours: number;
  groupId: string;
  color: string;
  notes?: string;
  icon?: string;
  continuous?: boolean;
  rowId?: string;
  autoEstimateDays?: Project['autoEstimateDays'];
};

const toDateString = (
  value: Date | string | undefined,
  fallback?: () => Date
): string | null => {
  if (value === undefined || value === null) {
    return fallback ? fallback().toISOString().split('T')[0] : null;
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
};

const transformProjectRow = (dbProject: SupabaseProjectRow): Project => ({
  id: dbProject.id,
  name: dbProject.name,
  client: dbProject.client,
  clientId: dbProject.client_id || '',
  startDate: new Date(dbProject.start_date),
  endDate: new Date(dbProject.end_date),
  estimatedHours: dbProject.estimated_hours,
  color: normalizeProjectColor(dbProject.color),
  groupId: dbProject.group_id || undefined,
  rowId: dbProject.row_id || undefined,
  notes: dbProject.notes || undefined,
  icon: dbProject.icon || undefined,
  continuous: dbProject.continuous ?? false,
  status: 'current',
  autoEstimateDays:
    dbProject.working_day_overrides && typeof dbProject.working_day_overrides === 'object'
      ? (dbProject.working_day_overrides as Project['autoEstimateDays'])
      : {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
  userId: dbProject.user_id || '',
  createdAt: dbProject.created_at ? new Date(dbProject.created_at) : new Date(),
  updatedAt: dbProject.updated_at ? new Date(dbProject.updated_at) : new Date(),
});

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const fetchedProjects = await ProjectOrchestrator.getAllProjects();
      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'useProjects',
        action: 'Error fetching projects',
      });
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProjects();

    return () => {
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
    };
  }, [fetchProjects]);

  const addProject = useCallback(
    async (projectData: AddProjectInput, options: ProjectToastOptions = {}) => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) throw new Error('User not authenticated');

        const clientIdentifier = projectData.clientId || projectData.client || 'N/A';
        const clientId = await ProjectOrchestrator.ensureClientExists(clientIdentifier, user.id);

        const startDate = toDateString(projectData.startDate) ?? new Date().toISOString().split('T')[0];
        const endDate =
          toDateString(projectData.endDate, () => {
            if (!projectData.continuous) {
              return projectData.startDate instanceof Date
                ? projectData.startDate
                : new Date(projectData.startDate);
            }
            const farFuture = new Date();
            farFuture.setFullYear(farFuture.getFullYear() + 100);
            return farFuture;
          }) ?? startDate;

        const dbData: SupabaseProjectInsert = {
          user_id: user.id,
          name: projectData.name || 'New Project',
          client: projectData.client || clientIdentifier,
          client_id: clientId,
          start_date: startDate,
          end_date: endDate,
          estimated_hours: projectData.estimatedHours,
          color: projectData.color,
          notes: projectData.notes ?? null,
          icon: projectData.icon ?? null,
          continuous: projectData.continuous ?? false,
          group_id: projectData.groupId,
          row_id: projectData.rowId ?? null,
          working_day_overrides: projectData.autoEstimateDays ?? null,
        };

        const { data, error } = await supabase
          .from('projects')
          .insert([dbData])
          .select()
          .single();

        if (error) {
          ErrorHandlingService.handle(error, {
            source: 'useProjects',
            action: 'Database insert error',
          });
          throw error;
        }

        const refreshed = await fetchProjects();
        const createdProject =
          refreshed.find((project) => project.id === data.id) ?? transformProjectRow(data as SupabaseProjectRow);

        if (!options.silent) {
          toast({
            title: 'Success',
            description: 'Project created successfully',
          });
        }

        return createdProject;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useProjects',
          action: 'Error adding project',
        });
        toast({
          title: 'Error',
          description: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: 'destructive',
        });
        throw error;
      }
    },
    [fetchProjects, toast]
  );

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project>, options: ProjectToastOptions = {}) => {
      try {
        const currentProject = projects.find((project) => project.id === id);
        if (!currentProject) {
          throw new Error('Project not found');
        }

        const result = await ProjectOrchestrator.updateProjectWorkflow(
          id,
          updates,
          currentProject,
          [],
          options
        );

        if (!result.success) {
          throw new Error(result.errors?.join(', ') || 'Update failed');
        }

        await fetchProjects();

        if (!options.silent) {
          if (updateToastTimeoutRef.current) {
            clearTimeout(updateToastTimeoutRef.current);
          }
          updateToastTimeoutRef.current = setTimeout(() => {
            toast({
              title: 'Success',
              description: 'Project updated successfully',
            });
          }, 500);
        }

        return result.project;
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useProjects',
          action: 'Error updating project',
        });
        toast({
          title: 'Error',
          description: 'Failed to update project',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [fetchProjects, projects, toast]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        const result = await ProjectOrchestrator.deleteProjectWorkflow(id);

        if (!result.success) {
          throw new Error(result.errors?.join(', ') || 'Delete failed');
        }

        setProjects((prev) => prev.filter((project) => project.id !== id));

        toast({
          title: 'Success',
          description: 'Project deleted successfully',
        });
      } catch (error) {
        ErrorHandlingService.handle(error, {
          source: 'useProjects',
          action: 'Error deleting project',
        });
        toast({
          title: 'Error',
          description: 'Failed to delete project',
          variant: 'destructive',
        });
        throw error;
      }
    },
    [toast]
  );

  const reorderProjects = useCallback(
    (groupId: string, fromIndex: number, toIndex: number) => {
      const groupProjects = projects.filter((project) => project.groupId === groupId);
      const updatedGroup = [...groupProjects];
      const [moved] = updatedGroup.splice(fromIndex, 1);
      updatedGroup.splice(toIndex, 0, moved);

      setProjects((prev) => [
        ...prev.filter((project) => project.groupId !== groupId),
        ...updatedGroup,
      ]);
    },
    [projects]
  );

  const showSuccessToast = useCallback(
    (message: string = 'Project updated successfully') => {
      toast({
        title: 'Success',
        description: message,
      });
    },
    [toast]
  );

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    reorderProjects,
    showSuccessToast,
    refetch: fetchProjects,
  };
}