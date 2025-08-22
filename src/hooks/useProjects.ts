import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type DatabaseProject = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// Frontend Project interface with Date objects
interface Project {
  id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  color: string;
  groupId: string;
  rowId: string;
  notes?: string;
  icon?: string;
  continuous?: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Transform database project to frontend project
function transformDatabaseProject(dbProject: DatabaseProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    client: dbProject.client,
    startDate: new Date(dbProject.start_date),
    endDate: new Date(dbProject.end_date),
    estimatedHours: dbProject.estimated_hours,
    color: dbProject.color,
    groupId: dbProject.group_id,
    rowId: dbProject.row_id,
    notes: dbProject.notes || undefined,
    icon: dbProject.icon || undefined,
    continuous: dbProject.continuous ?? false,
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
    userId: dbProject.user_id,
  };
}

// Transform frontend project data to database format
function transformToDatabase(projectData: any): any {
  const dbData: any = {};
  
  if (projectData.name !== undefined) dbData.name = projectData.name;
  if (projectData.client !== undefined) dbData.client = projectData.client;
  if (projectData.startDate !== undefined) {
    dbData.start_date = projectData.startDate instanceof Date 
      ? projectData.startDate.toISOString().split('T')[0] 
      : projectData.startDate;
  }
  if (projectData.endDate !== undefined) {
    dbData.end_date = projectData.endDate instanceof Date 
      ? projectData.endDate.toISOString().split('T')[0] 
      : projectData.endDate;
  }
  if (projectData.estimatedHours !== undefined) dbData.estimated_hours = projectData.estimatedHours;
  if (projectData.color !== undefined) dbData.color = projectData.color;
  if (projectData.groupId !== undefined) dbData.group_id = projectData.groupId;
  if (projectData.rowId !== undefined) dbData.row_id = projectData.rowId;
  if (projectData.notes !== undefined) dbData.notes = projectData.notes;
  if (projectData.icon !== undefined) dbData.icon = projectData.icon;
  if (projectData.continuous !== undefined) dbData.continuous = projectData.continuous;
  
  return dbData;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  console.log('🚀 useProjects hook initialized');
  
  // Debouncing for update success toasts
  const updateToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('🔥 useProjects useEffect triggered');
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
      
      // Test the connection first
      const { data: testData, error: testError } = await supabase
        .from('projects')
        .select('count')
        .limit(1);
      console.log('🔍 Database connection test:', { testData, testError });
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 fetchProjects: Current user:', user?.id);
      
      if (!user) {
        console.log('❌ No authenticated user found');
        setProjects([]);
        return;
      }

      // Test user-specific query
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      console.log('🔍 fetchProjects: Raw query result:', { data, error, userFiltered: true });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        throw error;
      }
      
      console.log('🔍 fetchProjects: Raw data count:', data?.length || 0);
      
      // Transform database projects to frontend format
      const transformedProjects = (data || []).map((dbProject, index) => {
        console.log(`🔍 Transforming project ${index}:`, dbProject);
        const transformed = transformDatabaseProject(dbProject);
        console.log(`🔍 Transformed project ${index}:`, transformed);
        return transformed;
      });
      
      console.log('🔍 fetchProjects: Setting projects:', transformedProjects.length, 'projects');
      setProjects(transformedProjects);
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

  const addProject = async (projectData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Transform frontend data to database format
      const dbData = transformToDatabase(projectData);

      const { data, error } = await supabase
        .from('projects')
        .insert([{ ...dbData, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;
      
      // Transform the returned data to frontend format
      const transformedProject = transformDatabaseProject(data);
      setProjects(prev => [...prev, transformedProject]);
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      return transformedProject;
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

  const updateProject = async (id: string, updates: any, options: { silent?: boolean } = {}) => {
    try {
      // Transform frontend data to database format
      const dbUpdates = transformToDatabase(updates);

      const { data, error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Transform the returned data to frontend format
      const transformedProject = transformDatabaseProject(data);
      setProjects(prev => 
        prev.map(p => p.id === id ? transformedProject : p)
      );
      
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
      
      return transformedProject;
    } catch (error) {
      console.error('❌ Error updating project:', error);
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