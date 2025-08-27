/**
 * Central Calculation Services Index
 * Single import point for all mathematical operations
 * 
 * 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
 * 
 * ❌ DON'T add calculations to:
 *    - Components (render logic only)
 *    - Hooks (state management only) 
 *    - Utils (use these services instead)
 *
 * ✅ Extracted business logic services:
 */

// Business logic services
export * from './recurringMilestoneService';
export * from './cachePerformanceService';
export * from './eventDurationService';
export * from './eventOverlapService';
export * from './timeFormattingService';
export * from './dateRangeService';
export * from './calendarInsightService';
export * from './projectProgressService';
export * from './eventSplittingService';
export * from './reportCalculationService';
export * from './timelinePositionService';
export * from './workHourCreationService';
export * from './dragCalculationService';
export * from './timelineViewportService';
export * from './milestoneManagementService';
export * from './performanceMetricsService';
export * from './projectProgressGraphService';
export * from './settingsValidationService';
export * from './eventWorkHourIntegrationService';
export * from './workHourCapacityService';
export * from './projectCalculationService';
export * from './milestoneUtilitiesService';

// Core calculation services
export { DateCalculationService } from './DateCalculationService';
export { ProjectCalculationService } from './ProjectCalculationService';
export { TimelineCalculationService } from './TimelineCalculationService';
export { CalculationCacheService } from './CalculationCacheService';

// Memoized calculation factories
import { CalculationCacheService } from './CalculationCacheService';
import { ProjectCalculationService } from './ProjectCalculationService';
import { DateCalculationService } from './DateCalculationService';
import { TimelineCalculationService } from './TimelineCalculationService';

/**
 * Pre-configured memoized calculation functions
 * Use these instead of calling services directly for better performance
 */

// Memoized project calculations
export const calculateProjectMetrics = CalculationCacheService.memoize(
  'projectCalculations',
  ProjectCalculationService.calculateProjectMetrics,
  (project, settings, holidays = []) => 
    `${project.id}_${project.startDate}_${project.endDate}_${project.estimated_hours}_${holidays.length}`
);

export const calculateMilestoneMetrics = CalculationCacheService.memoize(
  'milestoneCalculations',
  ProjectCalculationService.calculateMilestoneMetrics,
  (milestones, projectBudget) => 
    `${milestones.map(m => `${m.id}_${m.time_allocation}`).join('|')}_${projectBudget}`
);

// Memoized date calculations
export const getBusinessDaysBetween = CalculationCacheService.memoize(
  'dateCalculations',
  DateCalculationService.getBusinessDaysBetween,
  (start, end, holidays = []) => 
    `${start.toISOString()}_${end.toISOString()}_${holidays.map(h => h.toISOString()).join('|')}`
);

export const getBusinessDaysInRange = CalculationCacheService.memoize(
  'dateCalculations',
  DateCalculationService.getBusinessDaysInRange,
  (start, end, holidays = []) => 
    `range_${start.toISOString()}_${end.toISOString()}_${holidays.map(h => h.toISOString()).join('|')}`
);

// Memoized timeline calculations
export const calculateProjectPosition = CalculationCacheService.memoize(
  'timelinePositions',
  TimelineCalculationService.calculateProjectPosition,
  (projectStart, projectEnd, viewport) => 
    `${projectStart.toISOString()}_${projectEnd.toISOString()}_${viewport.startDate.toISOString()}_${viewport.columnWidth}_${viewport.mode}`
);

export const calculateMilestonePosition = CalculationCacheService.memoize(
  'timelinePositions',
  TimelineCalculationService.calculateMilestonePosition,
  (milestoneDate, projectStart, projectPosition, viewport) => 
    `milestone_${milestoneDate.toISOString()}_${projectStart.toISOString()}_${projectPosition.left}_${viewport.columnWidth}`
);

/**
 * Utility functions for common calculation patterns
 */

/**
 * Batch calculate metrics for multiple projects
 */
export function calculateMultipleProjectMetrics(
  projects: any[], 
  settings: any, 
  holidays: Date[] = []
) {
  return projects.map(project => ({
    projectId: project.id,
    metrics: calculateProjectMetrics(project, settings, holidays)
  }));
}

/**
 * Calculate project conflicts and overlaps
 */
export function analyzeProjectConflicts(projects: any[]) {
  return ProjectCalculationService.calculateProjectOverlaps(projects);
}

/**
 * Validate entire project portfolio
 */
export function validateProjectPortfolio(
  projects: any[], 
  milestones: any[], 
  settings: any
) {
  const results = {
    projects: projects.map(project => ({
      projectId: project.id,
      metrics: calculateProjectMetrics(project, settings),
      milestones: milestones
        .filter(m => m.project_id === project.id)
        .map(milestone => ProjectCalculationService.validateMilestoneTimeline([milestone], project, settings))
    })),
    conflicts: analyzeProjectConflicts(projects),
    totalWorkload: projects.reduce((sum, p) => sum + p.estimated_hours, 0)
  };

  return results;
}

/**
 * Performance monitoring for calculations
 */
export function getCalculationPerformanceStats() {
  return {
    projectCalculations: CalculationCacheService.getCacheStats('projectCalculations'),
    timelinePositions: CalculationCacheService.getCacheStats('timelinePositions'),
    dateCalculations: CalculationCacheService.getCacheStats('dateCalculations'),
    milestoneCalculations: CalculationCacheService.getCacheStats('milestoneCalculations')
  };
}

/**
 * Clear all calculation caches (useful for testing or data changes)
 */
export function clearAllCalculationCaches() {
  CalculationCacheService.clearAllCaches();
}
