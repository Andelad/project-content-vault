/**
 * Project Bar Resize Service
 * 
 * Handles validation and collision detection for project bar resize operations.
 * Validates that projects can't be dragged past completed/planned time,
 * and detects collisions with other projects on the same visual row.
 * 
 * Created: November 2025
 */

import { normalizeToMidnight, addDaysToDate } from '@/services';
import type { Project } from '@/types/core';
import type { DayEstimate } from '@/types/core';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MIN_PROJECT_GAP_DAYS = 1; // Require at least one blank day between projects on same row

export interface ResizeValidationResult {
  isValid: boolean;
  reason?: string;
  adjustedDate?: Date;
  shouldShowToast?: boolean;
  toastMessage?: string;
}

export interface CollisionDetectionResult {
  hasCollision: boolean;
  collidingProject?: Project;
  snapToDate?: Date; // Suggested snap target
  toastMessage?: string;
  constraint?: 'min' | 'max';
}

/**
 * Validate resize bounds based on planned/completed time constraints
 * 
 * Rules:
 * - Can't drag start date forward past first planned/completed event
 * - Can't drag end date backward past last planned/completed event
 * - Backwards start movement and forwards end movement remain unrestricted by events
 */
export function validateResizeBounds(
  action: 'resize-start-date' | 'resize-end-date',
  newDate: Date,
  project: Project,
  dayEstimates: DayEstimate[]
): ResizeValidationResult {
  const normalizedNewDate = normalizeToMidnight(new Date(newDate));
  const normalizedStartDate = normalizeToMidnight(new Date(project.startDate));
  const normalizedEndDate = normalizeToMidnight(new Date(project.endDate));
  const plannedOrCompletedDates = dayEstimates
    .filter(est => 
      est.projectId === project.id &&
      est.source === 'event' &&
      (est.isPlannedEvent || est.isCompletedEvent)
    )
    .map(est => normalizeToMidnight(new Date(est.date)))
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (action === 'resize-start-date') {
    const isMovingForward = normalizedNewDate > normalizedStartDate;

    if (isMovingForward && plannedOrCompletedDates.length > 0) {
      const earliestEventDate = plannedOrCompletedDates[0];

      // Can't drag start date after first planned/completed event
      if (normalizedNewDate > earliestEventDate) {
        return {
          isValid: false,
          reason: 'Cannot move start date past planned or completed time',
          adjustedDate: earliestEventDate,
          shouldShowToast: true,
          toastMessage: 'Cannot move start date past planned or completed time'
        };
      }
    }

    if (normalizedNewDate > normalizedEndDate) {
      return {
        isValid: false,
        reason: 'Start date cannot be after end date',
        adjustedDate: normalizedEndDate,
        shouldShowToast: false
      };
    }
  }
  
  if (action === 'resize-end-date') {
    const isMovingBackward = normalizedNewDate < normalizedEndDate;

    if (isMovingBackward && plannedOrCompletedDates.length > 0) {
      const latestEventDate = plannedOrCompletedDates[plannedOrCompletedDates.length - 1];

      // Can't drag end date before last planned/completed event
      if (normalizedNewDate < latestEventDate) {
        return {
          isValid: false,
          reason: 'Cannot move end date before planned or completed time',
          adjustedDate: latestEventDate,
          shouldShowToast: true,
          toastMessage: 'Cannot move end date before planned or completed time'
        };
      }
    }

    if (normalizedNewDate < normalizedStartDate) {
      return {
        isValid: false,
        reason: 'End date cannot be before start date',
        adjustedDate: normalizedStartDate,
        shouldShowToast: false
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Detect collisions with other projects on the same visual row
 * 
 * Rules:
 * - Only check projects on the same visual row
 * - Not impacted by projects in the same group but different rows
 * - If collision detected, snap to one day before the colliding project
 */
export function detectRowCollision(
  action: 'resize-start-date' | 'resize-end-date',
  newDate: Date,
  project: Project,
  allProjects: Project[]
): CollisionDetectionResult {
  const normalizedNewDate = normalizeToMidnight(new Date(newDate));
  const normalizedOriginalStart = normalizeToMidnight(new Date(project.startDate));
  const normalizedOriginalEnd = normalizeToMidnight(new Date(project.endDate));
  
  // Filter to projects on the same row (excluding the current project)
  const sameRowProjects = allProjects.filter(p => 
    p.id !== project.id && 
    p.rowId === project.rowId
  );
  
  for (const otherProject of sameRowProjects) {
    const otherStart = normalizeToMidnight(new Date(otherProject.startDate));
    const otherEnd = normalizeToMidnight(new Date(otherProject.endDate));
    const diffFromLeftProject = Math.round((normalizedNewDate.getTime() - otherEnd.getTime()) / DAY_IN_MS);
    const diffFromRightProject = Math.round((otherStart.getTime() - normalizedNewDate.getTime()) / DAY_IN_MS);

    if (action === 'resize-start-date') {
      const isLeftNeighbor = otherEnd <= normalizedOriginalStart;

      if (!isLeftNeighbor) {
        continue;
      }

      // Prevent overlaps or removing the required gap when approaching left neighbor
      if (normalizedNewDate <= otherEnd || diffFromLeftProject <= MIN_PROJECT_GAP_DAYS) {
        const snapDate = addDaysToDate(otherEnd, MIN_PROJECT_GAP_DAYS + 1);
        
        return {
          hasCollision: true,
          collidingProject: otherProject,
          snapToDate: snapDate,
          toastMessage: `Moved to maintain spacing from "${otherProject.name}". Edit other project to move further.`,
          constraint: 'min'
        };
      }
    }
    
    if (action === 'resize-end-date') {
      const isRightNeighbor = otherStart >= normalizedOriginalEnd;

      if (isRightNeighbor) {
        if (normalizedNewDate >= otherStart || diffFromRightProject <= MIN_PROJECT_GAP_DAYS) {
          const snapDate = addDaysToDate(otherStart, -(MIN_PROJECT_GAP_DAYS + 1));

          return {
            hasCollision: true,
            collidingProject: otherProject,
            snapToDate: snapDate,
            toastMessage: `Moved to maintain spacing from "${otherProject.name}". Edit other project to move further.`,
            constraint: 'max'
          };
        }
      }

      // Ensure we don't move the end too close to a left neighbor when shrinking duration
      if (!isRightNeighbor && otherEnd <= normalizedOriginalEnd && diffFromLeftProject <= MIN_PROJECT_GAP_DAYS && diffFromLeftProject >= 0) {
        const snapDate = addDaysToDate(otherEnd, MIN_PROJECT_GAP_DAYS + 1);

        return {
          hasCollision: true,
          collidingProject: otherProject,
          snapToDate: snapDate,
          toastMessage: `Moved to maintain spacing from "${otherProject.name}". Edit other project to move further.`,
          constraint: 'min'
        };
      }
    }
  }
  
  return { hasCollision: false };
}

/**
 * Calculate new project dates based on resize action
 * Maintains duration for start date changes, adjusts duration for end date changes
 */
export function calculateResizedDates(
  action: 'resize-start-date' | 'resize-end-date',
  newDate: Date,
  project: Project
): { startDate: Date; endDate: Date } {
  const normalizedNewDate = normalizeToMidnight(new Date(newDate));
  const currentStart = normalizeToMidnight(new Date(project.startDate));
  const currentEnd = normalizeToMidnight(new Date(project.endDate));
  
  if (action === 'resize-start-date') {
    // Duration increases/decreases: end date stays the same, start moves
    return {
      startDate: normalizedNewDate,
      endDate: currentEnd
    };
  }
  
  if (action === 'resize-end-date') {
    // Duration increases/decreases: start date stays the same, end moves
    return {
      startDate: currentStart,
      endDate: normalizedNewDate
    };
  }
  
  // Fallback - shouldn't reach here
  return {
    startDate: currentStart,
    endDate: currentEnd
  };
}
