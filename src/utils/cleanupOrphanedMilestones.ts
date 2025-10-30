import { supabase } from '@/integrations/supabase/client';

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
      .from('milestones')
      .select('*')
      .eq('project_id', projectId);

    if (error) throw error;

    // Find recurring templates
    const templates = allMilestones?.filter(m => m.is_recurring === true) || [];
    const templateNames = new Set(templates.map(t => t.name));

    // Find numbered instances
    const numberedInstances = allMilestones?.filter(m => {
      if (m.is_recurring === true) return false;
      const match = m.name?.match(/^(.+) \d+$/);
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
      .map(m => m.id);

    if (orphanedIds.length === 0) {
      console.log('No orphaned milestones found');
      return { deleted: 0 };
    }

    console.log(`Found ${orphanedIds.length} orphaned milestones to delete`);

    // Delete orphaned instances
    const { error: deleteError } = await supabase
      .from('milestones')
      .delete()
      .in('id', orphanedIds);

    if (deleteError) throw deleteError;

    console.log(`Successfully deleted ${orphanedIds.length} orphaned milestones`);
    return { deleted: orphanedIds.length };
  } catch (error) {
    console.error('Error cleaning up orphaned milestones:', error);
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
    console.error('Error cleaning up all orphaned milestones:', error);
    throw error;
  }
}
