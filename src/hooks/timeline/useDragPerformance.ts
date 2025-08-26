import { useCallback, useRef } from 'react';

/**
 * Performance-optimized drag handling hook
 * Debounces drag updates and batches milestone operations
 */
export function useDragPerformance() {
  const dragUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMilestoneUpdates = useRef<Map<string, { dueDate: Date }>>(new Map());

  // Debounced project update for smoother drag performance
  const debouncedProjectUpdate = useCallback((
    updateProject: Function,
    projectId: string,
    updateData: any,
    delay: number = 50
  ) => {
    if (dragUpdateTimeoutRef.current) {
      clearTimeout(dragUpdateTimeoutRef.current);
    }

    dragUpdateTimeoutRef.current = setTimeout(() => {
      updateProject(projectId, updateData, { silent: true });
      dragUpdateTimeoutRef.current = null;
    }, delay);
  }, []);

  // Batch milestone updates for better performance
  const batchMilestoneUpdate = useCallback((
    updateMilestone: Function,
    milestoneId: string,
    updateData: { dueDate: Date },
    flushDelay: number = 100
  ) => {
    // Store the update
    pendingMilestoneUpdates.current.set(milestoneId, updateData);

    // Debounce the flush
    if (dragUpdateTimeoutRef.current) {
      clearTimeout(dragUpdateTimeoutRef.current);
    }

    dragUpdateTimeoutRef.current = setTimeout(() => {
      // Flush all pending milestone updates
      const updates = Array.from(pendingMilestoneUpdates.current.entries());
      pendingMilestoneUpdates.current.clear();

      updates.forEach(([id, data]) => {
        updateMilestone(id, data, { silent: true });
      });

      dragUpdateTimeoutRef.current = null;
    }, flushDelay);
  }, []);

  // Cleanup function
  const clearPendingUpdates = useCallback(() => {
    if (dragUpdateTimeoutRef.current) {
      clearTimeout(dragUpdateTimeoutRef.current);
      dragUpdateTimeoutRef.current = null;
    }
    pendingMilestoneUpdates.current.clear();
  }, []);

  return {
    debouncedProjectUpdate,
    batchMilestoneUpdate,
    clearPendingUpdates
  };
}
