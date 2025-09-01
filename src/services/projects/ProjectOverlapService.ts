/**
 * Project Overlap Service
 * 
 * Handles business logic for project conflicts and drag operations.
 * Extracted from legacy overlap service for better organization.
 * 
 * Architecture: Domain -> Calculations -> Orchestrators -> Validators -> Repository
 */

import { Project } from '@/types/core';
import { datesOverlap } from './ProjectCalculations';

// =====================================================================================
// TYPES & INTERFACES
// =====================================================================================

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflictingProjects: Project[];
  conflictDetails: Array<{
    projectId: string;
    overlapType: 'partial' | 'complete' | 'adjacent';
    overlapDays: number;
  }>;
}

export interface DateAdjustmentResult {
  originalStartDate: Date;
  originalEndDate: Date;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  wasAdjusted: boolean;
  adjustmentReason?: string;
}

// =====================================================================================
// PROJECT OVERLAP BUSINESS LOGIC
// =====================================================================================

/**
 * Check if a project would overlap with existing projects in the same row
 */
export function checkProjectOverlap(
  projectId: string,
  rowId: string,
  startDate: Date,
  endDate: Date,
  allProjects: Project[]
): Project[] {
  const projectsInSameRow = allProjects.filter(
    project => project.rowId === rowId && project.id !== projectId
  );

  const overlappingProjects = projectsInSameRow.filter(project =>
    datesOverlap(startDate, endDate, new Date(project.startDate), new Date(project.endDate))
  );

  return overlappingProjects;
}

/**
 * Detect live drag conflicts during drag operations
 */
export function detectLiveDragConflicts(
  draggedProjectId: string,
  newDates: { startDate: Date, endDate: Date },
  rowId: string,
  allProjects: Project[]
): ConflictDetectionResult {
  const overlappingProjects = checkProjectOverlap(
    draggedProjectId,
    rowId,
    newDates.startDate,
    newDates.endDate,
    allProjects
  );

  const conflictDetails = overlappingProjects.map(conflict => {
    const overlapStart = Math.max(newDates.startDate.getTime(), new Date(conflict.startDate).getTime());
    const overlapEnd = Math.min(newDates.endDate.getTime(), new Date(conflict.endDate).getTime());
    const overlapDays = Math.ceil((overlapEnd - overlapStart) / (24 * 60 * 60 * 1000)) + 1;

    // Determine overlap type
    let overlapType: 'partial' | 'complete' | 'adjacent';
    const draggedDuration = Math.ceil((newDates.endDate.getTime() - newDates.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const conflictDuration = Math.ceil((new Date(conflict.endDate).getTime() - new Date(conflict.startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1;

    if (overlapDays === draggedDuration && overlapDays === conflictDuration) {
      overlapType = 'complete';
    } else if (overlapDays === 1) {
      overlapType = 'adjacent';
    } else {
      overlapType = 'partial';
    }

    return {
      projectId: conflict.id,
      overlapType,
      overlapDays
    };
  });

  return {
    hasConflicts: overlappingProjects.length > 0,
    conflictingProjects: overlappingProjects,
    conflictDetails
  };
}

/**
 * Resolve drag conflicts using different strategies
 */
export function resolveDragConflicts(
  proposedDates: { startDate: Date, endDate: Date },
  conflicts: Project[],
  resolutionStrategy: 'adjust' | 'prevent' | 'allow'
): DateAdjustmentResult {
  const result: DateAdjustmentResult = {
    originalStartDate: proposedDates.startDate,
    originalEndDate: proposedDates.endDate,
    adjustedStartDate: proposedDates.startDate,
    adjustedEndDate: proposedDates.endDate,
    wasAdjusted: false
  };

  if (conflicts.length === 0 || resolutionStrategy === 'allow') {
    return result;
  }

  if (resolutionStrategy === 'prevent') {
    result.adjustmentReason = 'Conflicts detected - drag prevented';
    return result;
  }

  if (resolutionStrategy === 'adjust') {
    // Find the nearest available slot
    const adjustedDates = findNearestAvailableSlot(
      conflicts[0].rowId,
      proposedDates.startDate,
      proposedDates.endDate,
      conflicts,
      'auto'
    );

    result.adjustedStartDate = adjustedDates.startDate;
    result.adjustedEndDate = adjustedDates.endDate;
    result.wasAdjusted = true;
    result.adjustmentReason = 'Adjusted to avoid conflicts';
  }

  return result;
}

/**
 * Find the nearest available date range that doesn't overlap with existing projects
 */
export function findNearestAvailableSlot(
  rowId: string,
  requestedStartDate: Date,
  requestedEndDate: Date,
  allProjects: Project[],
  direction: 'forward' | 'backward' | 'auto' = 'auto'
): { startDate: Date; endDate: Date } {
  const projectsInSameRow = allProjects
    .filter(project => project.rowId === rowId)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const requestedDuration = Math.ceil((requestedEndDate.getTime() - requestedStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // Try to find a slot without overlaps
  const checkSlot = (testStart: Date) => {
    const testEnd = new Date(testStart);
    testEnd.setDate(testStart.getDate() + requestedDuration - 1);

    const overlaps = projectsInSameRow.some(project =>
      datesOverlap(testStart, testEnd, new Date(project.startDate), new Date(project.endDate))
    );

    return overlaps ? null : { startDate: testStart, endDate: testEnd };
  };

  // If auto direction, try both forward and backward, prefer the one that moves less
  if (direction === 'auto') {
    // Try original dates first
    const originalSlot = checkSlot(requestedStartDate);
    if (originalSlot) {
      return originalSlot;
    }

    // Find conflicting projects
    const conflictingProjects = projectsInSameRow.filter(project =>
      datesOverlap(requestedStartDate, requestedEndDate, new Date(project.startDate), new Date(project.endDate))
    );

    if (conflictingProjects.length === 0) {
      return { startDate: requestedStartDate, endDate: requestedEndDate };
    }

    // Try placing after the last conflicting project
    const latestEnd = Math.max(...conflictingProjects.map(p => new Date(p.endDate).getTime()));
    const forwardStart = new Date(latestEnd);
    forwardStart.setDate(forwardStart.getDate() + 1);

    // Try placing before the first conflicting project
    const earliestStart = Math.min(...conflictingProjects.map(p => new Date(p.startDate).getTime()));
    const backwardEnd = new Date(earliestStart);
    backwardEnd.setDate(backwardEnd.getDate() - 1);
    const backwardStart = new Date(backwardEnd);
    backwardStart.setDate(backwardStart.getDate() - requestedDuration + 1);

    // Calculate distances and prefer the closer option
    const forwardDistance = forwardStart.getTime() - requestedStartDate.getTime();
    const backwardDistance = requestedStartDate.getTime() - backwardStart.getTime();

    if (backwardDistance <= forwardDistance && backwardStart.getTime() >= 0) {
      const backwardSlot = checkSlot(backwardStart);
      if (backwardSlot) {
        return backwardSlot;
      }
    }

    const forwardSlot = checkSlot(forwardStart);
    if (forwardSlot) {
      return forwardSlot;
    }

    // If both fail, try the backward option anyway
    return { startDate: backwardStart, endDate: backwardEnd };
  }

  // For specific directions
  if (direction === 'forward') {
    const conflictingProjects = projectsInSameRow.filter(project =>
      datesOverlap(requestedStartDate, requestedEndDate, new Date(project.startDate), new Date(project.endDate))
    );

    if (conflictingProjects.length === 0) {
      return { startDate: requestedStartDate, endDate: requestedEndDate };
    }

    const latestEnd = Math.max(...conflictingProjects.map(p => new Date(p.endDate).getTime()));
    const newStart = new Date(latestEnd);
    newStart.setDate(newStart.getDate() + 1);

    return checkSlot(newStart) || { startDate: newStart, endDate: new Date(newStart.getTime() + (requestedDuration - 1) * 24 * 60 * 60 * 1000) };
  }

  if (direction === 'backward') {
    const conflictingProjects = projectsInSameRow.filter(project =>
      datesOverlap(requestedStartDate, requestedEndDate, new Date(project.startDate), new Date(project.endDate))
    );

    if (conflictingProjects.length === 0) {
      return { startDate: requestedStartDate, endDate: requestedEndDate };
    }

    const earliestStart = Math.min(...conflictingProjects.map(p => new Date(p.startDate).getTime()));
    const newEnd = new Date(earliestStart);
    newEnd.setDate(newEnd.getDate() - 1);
    const newStart = new Date(newEnd);
    newStart.setDate(newStart.getDate() - requestedDuration + 1);

    return checkSlot(newStart) || { startDate: newStart, endDate: newEnd };
  }

  // Fallback
  return { startDate: requestedStartDate, endDate: requestedEndDate };
}

/**
 * Adjust project dates to avoid overlaps during drag operations
 */
export function adjustProjectDatesForDrag(
  projectId: string,
  originalStartDate: Date,
  originalEndDate: Date,
  newStartDate: Date,
  newEndDate: Date,
  rowId: string,
  allProjects: Project[]
): { startDate: Date; endDate: Date; adjusted: boolean } {
  const overlappingProjects = checkProjectOverlap(projectId, rowId, newStartDate, newEndDate, allProjects);

  if (overlappingProjects.length === 0) {
    return { startDate: newStartDate, endDate: newEndDate, adjusted: false };
  }

  // If there's an overlap, try to find the nearest available slot
  const adjustedDates = findNearestAvailableSlot(rowId, newStartDate, newEndDate, allProjects, 'auto');

  return { ...adjustedDates, adjusted: true };
}
