import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedProjectRef = useRef<string | null>(null);

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
      console.log('🔍 fetchProjects: Starting to fetch projects...');
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 fetchProjects: Current user:', user?.id);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });

      console.log('🔍 fetchProjects: Raw query result:', { data, error });
      
      if (error) throw error;
      
      console.log('🔍 fetchProjects: Setting projects:', data?.length || 0, 'projects');
      setProjects(data || []);
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (projectData: Omit<ProjectInsert, 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...projectData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error adding project:', error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateProject = async (id: string, updates: ProjectUpdate) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setProjects(prev => prev.map(project => project.id === id ? data : project));
      
      // Debounce success toast to prevent spam during drag operations
      lastUpdatedProjectRef.current = id;
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
      }
      
      updateToastTimeoutRef.current = setTimeout(() => {
        // Only show toast if this was the last project updated
        if (lastUpdatedProjectRef.current === id) {
          toast({
            title: "Success",
            description: "Project updated successfully",
          });
        }
      }, 500); // 500ms debounce delay
      
      return data;
    } catch (error) {
      console.error('Error updating project:', error);
      // Clear any pending success toast when there's an error
      if (updateToastTimeoutRef.current) {
        clearTimeout(updateToastTimeoutRef.current);
        updateToastTimeoutRef.current = null;
      }
      // Show error toast immediately
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProjects(prev => prev.filter(project => project.id !== id));
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting project:', error);
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
    const groupProjects = projects.filter(p => p.group_id === groupId);
    const [reorderedProject] = groupProjects.splice(fromIndex, 1);
    groupProjects.splice(toIndex, 0, reorderedProject);
    
    setProjects(prev => [
      ...prev.filter(p => p.group_id !== groupId),
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
    refetch: fetchProjects,
  };
}