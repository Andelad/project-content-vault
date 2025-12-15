import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@/types/core';
import { ProjectOrchestrator } from '@/services/orchestrators/ProjectOrchestrator';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    fetchProjects();
    
    // Cleanup timeout on unmount
    return () => {
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
    };
  }, []);
  
  const fetchProjects = async () => {
    try {
      const fetchedProjects = await ProjectOrchestrator.getAllProjects();
      setProjects(fetchedProjects);
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'useProjects', 
        action: 'Error fetching projects' 
      });
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const addProject = async (projectData: any, options: { silent?: boolean } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Ensure client exists and get client_id
      const clientIdentifier = projectData.clientId || projectData.client || 'N/A';
      const clientId = await ProjectOrchestrator.ensureClientExists(clientIdentifier, user.id);
      
      // Prepare project data with ensured client_id
      const preparedData = {
        ...projectData,
        clientId,
        user_id: user.id
      };
      
      // Transform to database format - only include snake_case fields
      const dbData: Record<string, unknown> = {
        user_id: user.id,
        name: projectData.name || 'New Project',
        client: projectData.client || clientIdentifier,
        client_id: clientId,
        start_date: preparedData.startDate instanceof Date 
          ? preparedData.startDate.toISOString().split('T')[0] 
          : preparedData.startDate,
        end_date: preparedData.endDate instanceof Date 
          ? preparedData.endDate.toISOString().split('T')[0] 
          : preparedData.endDate,
        estimated_hours: preparedData.estimatedHours,
        group_id: preparedData.groupId,
        color: projectData.color,
        notes: projectData.notes,
        icon: projectData.icon,
        continuous: projectData.continuous,
      };
      
      // Only include optional fields if they have values
      if (preparedData.rowId) dbData.row_id = preparedData.rowId;
      if (preparedData.autoEstimateDays) dbData.auto_estimate_days = preparedData.autoEstimateDays;
      
      const { data, error } = await supabase
        .from('projects')
        .insert([dbData as any])
        .select()
        .single();
      
      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'useProjects', 
          action: 'Database insert error' 
        });
        throw error;
      }
      
      // Refresh projects list to get properly transformed data
      await fetchProjects();
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        toast({
          title: "Success",
          description: "Project created successfully",
        });
      }
      
      return data as any; // Will be properly typed after fetchProjects
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'useProjects', 
        action: 'Error adding project' 
      });
      toast({
        title: "Error",
        description: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    }
  };
  const updateProject = async (id: string, updates: any, options: { silent?: boolean } = {}) => {
    try {
      const currentProject = projects.find(p => p.id === id);
      if (!currentProject) {
        throw new Error('Project not found');
      }
      
      const result = await ProjectOrchestrator.updateProjectWorkflow(
        id,
        updates,
        currentProject,
        [], // milestones - can be enhanced later if needed
        options
      );
      
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Update failed');
      }
      
      // Refresh projects list
      await fetchProjects();
      
      // Only show toast if not in silent mode
      if (!options.silent) {
        // Debounce success toast
        if (updateToastTimeoutRef.current) {
          clearTimeout(updateToastTimeoutRef.current);
        }
        updateToastTimeoutRef.current = setTimeout(() => {
          toast({
            title: "Success",
            description: "Project updated successfully",
          });
        }, 500);
      }
      
      return result.project;
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'useProjects', 
        action: 'Error updating project' 
      });
      // Always show error toasts immediately
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
      throw error;
    }
  };
  const showSuccessToast = (message: string = "Project updated successfully") => {
    toast({
      title: "Success",
      description: message,
    });
  };
  const deleteProject = async (id: string) => {
    try {
      const result = await ProjectOrchestrator.deleteProjectWorkflow(id);
      
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Delete failed');
      }
      
      setProjects(prev => prev.filter(project => project.id !== id));
      
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'useProjects', 
        action: 'Error deleting project' 
      });
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
      throw error;
    }
  };
  const reorderProjects = async (groupId: string, fromIndex: number, toIndex: number) => {
    // For now, just update local state - can implement proper ordering later
    const groupProjects = projects.filter(p => p.groupId === groupId);
    const [reorderedProject] = groupProjects.splice(fromIndex, 1);
    groupProjects.splice(toIndex, 0, reorderedProject);
    setProjects(prev => [
      ...prev.filter(p => p.groupId !== groupId),
      ...groupProjects
    ]);
  };
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