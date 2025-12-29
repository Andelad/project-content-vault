import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectContext } from '@/contexts/ProjectContext';
export function OrphanedPhasesCleaner() {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [orphanedCount, setOrphanedCount] = useState<number | null>(null);
  const { toast } = useToast();
  const { refetchMilestones } = useProjectContext();
  const scanForOrphans = async () => {
    setIsScanning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Get all user's milestones
      const { data: allMilestones, error } = await supabase
        .from('phases')
        .select('id, name, is_recurring, project_id')
        .eq('user_id', user.id);
      if (error) throw error;
      // Group by project
      const projectPhases = new Map<string, typeof allMilestones>();
      allMilestones?.forEach(m => {
        if (!projectPhases.has(m.project_id)) {
          projectPhases.set(m.project_id, []);
        }
        projectPhases.get(m.project_id)!.push(m);
      });
      // Find orphaned instances
      let totalOrphans = 0;
      projectPhases.forEach(milestones => {
        const templates = milestones.filter(p => m.is_recurring === true);
        const templateNames = new Set(templates.map(t => t.name));
        const numberedInstances = milestones.filter(p => {
          if (m.is_recurring === true) return false;
          const match = m.name?.match(/^(.+) \d+$/);
          return match !== null;
        });
        const orphaned = numberedInstances.filter(instance => {
          const match = instance.name?.match(/^(.+) \d+$/);
          if (!match) return false;
          const baseName = match[1];
          return !templateNames.has(baseName);
        });
        totalOrphans += orphaned.length;
      });
      setOrphanedCount(totalOrphans);
      if (totalOrphans === 0) {
        toast({
          title: "All Clean!",
          description: "No orphaned milestones found",
        });
      } else {
        toast({
          title: "Orphaned Milestones Found",
          description: `Found ${totalOrphans} orphaned milestone instances`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error scanning for orphans:', error);
      toast({
        title: "Error",
        description: "Failed to scan for orphaned milestones",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };
  const cleanupOrphans = async () => {
    setIsCleaning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Get all user's milestones
      const { data: allMilestones, error: fetchError } = await supabase
        .from('phases')
        .select('id, name, is_recurring, project_id')
        .eq('user_id', user.id);
      if (fetchError) throw fetchError;
      // Group by project
      const projectPhases = new Map<string, typeof allMilestones>();
      allMilestones?.forEach(m => {
        if (!projectPhases.has(m.project_id)) {
          projectPhases.set(m.project_id, []);
        }
        projectPhases.get(m.project_id)!.push(m);
      });
      // Find and delete orphaned instances
      const orphanedIds: string[] = [];
      projectPhases.forEach(milestones => {
        const templates = milestones.filter(p => m.is_recurring === true);
        const templateNames = new Set(templates.map(t => t.name));
        const numberedInstances = milestones.filter(p => {
          if (m.is_recurring === true) return false;
          const match = m.name?.match(/^(.+) \d+$/);
          return match !== null;
        });
        const orphaned = numberedInstances.filter(instance => {
          const match = instance.name?.match(/^(.+) \d+$/);
          if (!match) return false;
          const baseName = match[1];
          return !templateNames.has(baseName);
        });
        orphanedIds.push(...orphaned.map(p => m.id));
      });
      if (orphanedIds.length === 0) {
        toast({
          title: "Nothing to Clean",
          description: "No orphaned milestones found",
        });
        setOrphanedCount(0);
        return;
      }
      // Delete in batches of 100 to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('phases')
          .delete()
          .in('id', batch);
        if (deleteError) throw deleteError;
      }
      // Refetch milestones
      await refetchMilestones();
      toast({
        title: "Success",
        description: `Deleted ${orphanedIds.length} orphaned milestones`,
      });
      setOrphanedCount(0);
    } catch (error) {
      console.error('Error cleaning up orphans:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup orphaned milestones",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertTriangle className="w-5 h-5" />
          Orphaned Milestones Cleanup
        </CardTitle>
        <CardDescription>
          Scan for and remove orphaned milestone instances that no longer have a recurring template.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {orphanedCount !== null && (
          <div className="p-3 bg-white rounded border border-orange-200">
            <p className="text-sm font-medium">
              {orphanedCount === 0 ? (
                <span className="text-green-600">✓ No orphaned milestones found</span>
              ) : (
                <span className="text-orange-600">⚠ Found {orphanedCount} orphaned milestone instances</span>
              )}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={scanForOrphans}
            disabled={isScanning || isCleaning}
            variant="outline"
          >
            {isScanning ? 'Scanning...' : 'Scan for Orphans'}
          </Button>
          {orphanedCount !== null && orphanedCount > 0 && (
            <Button
              onClick={cleanupOrphans}
              disabled={isScanning || isCleaning}
              variant="destructive"
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isCleaning ? 'Cleaning...' : `Delete ${orphanedCount} Orphans`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
