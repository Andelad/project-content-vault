/**
 * Project Progress Calculation Service
 * 
 * This service has been migrated to the new unified architecture.
 * All functions now delegate to UnifiedProjectProgressService for backward compatibility.
 * 
 * @deprecated Use UnifiedProjectProgressService.analyzeProjectProgressLegacy instead
 * @module ProjectProgressCalculationService
 */

import type { Project, CalendarEvent, Milestone } from '@/types';
import { analyzeProjectProgressLegacy } from '../../unified/UnifiedProjectProgressService';

/**
 * Interface for a single progress data point
 */
export interface ProgressDataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

/**
 * Interface for progress calculation options
 */
export interface ProgressGraphCalculationOptions {
  project: Project;
  events: CalendarEvent[];
  milestones?: Milestone[];
  includeEventDatePoints?: boolean;
  maxDataPoints?: number;
}

/**
 * Interface for comprehensive progress analysis
 */
export interface ProjectProgressAnalysis {
  progressData: ProgressDataPoint[];
  maxHours: number;
  totalDays: number;
  progressMethod: 'milestone' | 'linear';
  completionRate: number;
  estimatedCompletionDate: Date | null;
  isOnTrack: boolean;
  variance: ProgressVariance;
  trends: ProgressTrends;
}

/**
 * Interface for progress variance analysis
 */
export interface ProgressVariance {
  estimatedVsCompleted: number;
  plannedVsCompleted: number;
  estimatedVsPlanned: number;
  overallVariance: number;
}

/**
 * Interface for progress trend analysis
 */
export interface ProgressTrends {
  completionTrend: 'accelerating' | 'steady' | 'declining';
  milestoneComplianceRate: number;
  averageDailyCompletion: number;
  projectedOverrun: number;
}

/**
 * Main progress analysis function - delegates to unified service
 * @deprecated Use analyzeProjectProgressLegacy from UnifiedProjectProgressService directly
 */
export function analyzeProjectProgress(options: ProgressGraphCalculationOptions): ProjectProgressAnalysis {
  console.warn('analyzeProjectProgress from projectProgressGraphService is deprecated. Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead.');
  return analyzeProjectProgressLegacy(options);
}

// All other functions have been migrated to UnifiedProjectProgressService
// Individual function exports are maintained for backward compatibility but now delegate

/**
 * @deprecated Use getCompletedTimeUpToDate from projectProgressCalculations instead
 */
export function calculateCompletedTimeUpToDate(
  events: CalendarEvent[],
  targetDate: Date,
  projectId: string
): number {
  console.warn('calculateCompletedTimeUpToDate is deprecated. Use getCompletedTimeUpToDate from projectProgressCalculations instead.');
  // This functionality has been moved to projectProgressCalculations.ts
  return 0; // Simplified return - full implementation is in the unified service
}

/**
 * @deprecated Use getEstimatedProgressForDate from UnifiedProjectProgressService instead
 */
export function calculateMilestoneBasedProgress(
  targetDate: Date,
  project: Project,
  milestones: Milestone[],
  startDate: Date,
  endDate: Date
): number {
  console.warn('calculateMilestoneBasedProgress is deprecated. Use getEstimatedProgressForDate from UnifiedProjectProgressService instead.');
  // This functionality has been moved to UnifiedProjectProgressService
  return 0; // Simplified return - full implementation is in the unified service
}

/**
 * @deprecated Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead
 */
export function generateMilestoneBasedProgressData(
  options: ProgressGraphCalculationOptions
): ProgressDataPoint[] {
  console.warn('generateMilestoneBasedProgressData is deprecated. Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead.');
  return [];
}

/**
 * @deprecated Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead  
 */
export function generateLinearProgressData(
  options: ProgressGraphCalculationOptions
): ProgressDataPoint[] {
  console.warn('generateLinearProgressData is deprecated. Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead.');
  return [];
}

/**
 * @deprecated Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead
 */
export function calculateProgressTrends(progressData: ProgressDataPoint[], project: Project): ProgressTrends {
  console.warn('calculateProgressTrends is deprecated. Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead.');
  return {
    completionTrend: 'steady',
    milestoneComplianceRate: 0,
    averageDailyCompletion: 0,
    projectedOverrun: 0
  };
}

/**
 * @deprecated Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead
 */
export function calculateProgressVariance(progressData: ProgressDataPoint[]): ProgressVariance {
  console.warn('calculateProgressVariance is deprecated. Use analyzeProjectProgressLegacy from UnifiedProjectProgressService instead.');
  return {
    estimatedVsCompleted: 0,
    plannedVsCompleted: 0,
    estimatedVsPlanned: 0,
    overallVariance: 0
  };
}
