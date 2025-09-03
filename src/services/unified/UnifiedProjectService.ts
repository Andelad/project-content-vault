/**
 * UNIFIED PROJECT SERVICE
 * Single source of truth for project business logic
 * Consolidates duplicate project calculations across services
 */

import { Project, Milestone } from '@/types';
import { ProjectEntity } from '@/services/core/domain/ProjectEntity';
import { MilestoneEntity } from '@/services/core/domain/MilestoneEntity';

// ============================================================================
// PROJECT BUSINESS LOGIC CONSOLIDATION
// ============================================================================

/**
 * Calculate project duration in days
 * Replaces duplicate implementations in:
 * - projectProgressService.calculateProjectDuration
 * - ProjectCalculationService.calculateDuration
 * - ProjectMetricsCalculationService methods
 */
export function calculateProjectDuration(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
}

/**
 * Calculate project progress percentage
 * Single source replacing multiple progress calculations
 */
export function calculateProjectProgress(
  project: Project,
  currentDate: Date = new Date()
): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  if (currentDate <= startDate) return 0;
  if (currentDate >= endDate) return 100;
  
  const totalDuration = calculateProjectDuration(startDate, endDate);
  const elapsed = calculateProjectDuration(startDate, currentDate);
  
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/**
 * Calculate total project workload (estimated hours)
 * Consolidates workload calculations from multiple services
 */
export function calculateProjectWorkload(project: Project): number {
  return project.estimatedHours || 0;
}

/**
 * Calculate daily work hours allocation for project
 * Replaces duplicate daily allocation calculations
 */
export function calculateDailyWorkAllocation(
  project: Project,
  targetDate: Date
): number {
  const projectDuration = calculateProjectDuration(
    new Date(project.startDate),
    new Date(project.endDate)
  );
  
  if (projectDuration <= 0) return 0;
  
  return (project.estimatedHours || 0) / projectDuration;
}

// ============================================================================
// MILESTONE BUSINESS LOGIC CONSOLIDATION  
// ============================================================================

/**
 * Calculate milestone completion status
 * Single source for milestone progress calculations
 */
export function calculateMilestoneProgress(
  milestone: Milestone,
  project: Project,
  currentDate: Date = new Date()
): { completed: boolean; overdue: boolean; progress: number } {
  const milestoneDate = new Date(milestone.dueDate);
  const projectStart = new Date(project.startDate);
  
  const completed = currentDate >= milestoneDate;
  const overdue = currentDate > milestoneDate; // Simplified - no completed field in Milestone type
  
  // Calculate progress based on time elapsed
  const totalTime = milestoneDate.getTime() - projectStart.getTime();
  const elapsedTime = currentDate.getTime() - projectStart.getTime();
  const progress = totalTime > 0 ? Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)) : 0;
  
  return { completed, overdue, progress };
}

/**
 * Calculate time distribution for milestone
 * Replaces milestoneUtilitiesService.calculateMilestoneTimeDistribution
 */
export function calculateMilestoneTimeDistribution(
  milestone: Milestone,
  project: Project
): { beforeDays: number; afterDays: number; totalDays: number } {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  const milestoneDate = new Date(milestone.dueDate);
  
  const totalDays = calculateProjectDuration(projectStart, projectEnd);
  const beforeDays = calculateProjectDuration(projectStart, milestoneDate);
  const afterDays = totalDays - beforeDays;
  
  return { beforeDays, afterDays, totalDays };
}

// ============================================================================
// PROJECT VALIDATION & BUSINESS RULES
// ============================================================================

/**
 * Validate project date constraints
 * Consolidated business rule validation
 */
export function validateProjectDates(
  startDate: Date,
  endDate: Date,
  milestones: Milestone[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic date validation using domain entity
  if (!ProjectEntity.validateDateRange(startDate, endDate)) {
    errors.push('Project end date must be after start date');
  }

  // Milestone validation
  milestones.forEach(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    if (milestoneDate < startDate || milestoneDate > endDate) {
      errors.push(`Milestone "${milestone.name || 'Unnamed'}" is outside project date range`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if project is active on given date
 * Single source for project activity checks
 */
export function isProjectActiveOnDate(project: Project, date: Date): boolean {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  
  return date >= startDate && date <= endDate;
}

// ============================================================================
// DELEGATION WRAPPERS (for migration compatibility)
// ============================================================================

/**
 * Legacy wrapper for projectProgressService.calculateProjectDuration
 * TODO: Remove after migration complete
 */
export function calculateProjectDuration_LEGACY(project: Project): number {
  return calculateProjectDuration(
    new Date(project.startDate),
    new Date(project.endDate)
  );
}
