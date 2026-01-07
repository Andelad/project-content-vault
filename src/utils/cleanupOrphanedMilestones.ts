import { supabase } from '@/integrations/supabase/client';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';
/**
 * Removes orphaned milestone instances that no longer have a recurring template.
 * These are milestones with:
 * - is_recurring = false
 * - name ending with a space and number (e.g., "Sprint 1", "Sprint 2")
 * - no corresponding template milestone (is_recurring = true) with the base name
 */
export async function cleanupOrphanedMilestones(projectId: string) {
  try {
    // Get all milestones for the project
    const { data: allMilestones, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    // Find recurring templates
    const templates = allMilestones?.filter(p => p.is_recurring === true) || [];
    const templateNames = new Set(templates.map(t => t.name));
    // Find numbered instances
    const numberedInstances = allMilestones?.filter(p => {
      if (p.is_recurring === true) return false;
      const match = p.name?.match(/^(.+) \d+$/);
      return match !== null;
    }) || [];
    // Find orphaned instances (no matching template)
    const orphanedIds = numberedInstances
      .filter(instance => {
        const match = instance.name?.match(/^(.+) \d+$/);
        if (!match) return false;
        const baseName = match[1];
        return !templateNames.has(baseName);
      })
      .map(p => p.id);
    if (orphanedIds.length === 0) {
      return { deleted: 0 };
    }
    // Delete orphaned instances
    const { error: deleteError } = await supabase
      .from('phases')
      .delete()
      .in('id', orphanedIds);
    if (deleteError) throw deleteError;
    return { deleted: orphanedIds.length };
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'cleanupOrphanedMilestones', action: 'Error cleaning up orphaned milestones:' });
    throw error;
  }
}
/**
 * Cleanup orphaned milestones for all projects of the current user
 */
export async function cleanupAllOrphanedMilestones() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    // Get all user's projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id);
    if (projectsError) throw projectsError;
    let totalDeleted = 0;
    for (const project of projects || []) {
      const result = await cleanupOrphanedMilestones(project.id);
      totalDeleted += result.deleted;
    }
    return { deleted: totalDeleted };
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'cleanupOrphanedMilestones', action: 'Error cleaning up all orphaned milestones:' });
    throw error;
  }
}
