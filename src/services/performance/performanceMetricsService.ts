/**
 * Performance Metrics Service
 * 
 * This service handles performance monitoring, usage calculations, and limit checking
 * for the application. It provides metrics for projects, groups, events, and memory usage
 * to help maintain optimal performance and provide warnings when approaching limits.
 * 
 * Key Features:
 * - Current usage calculations across all data entities
 * - Performance limit checking and threshold monitoring
 * - Memory usage tracking and analysis
 * - Group-based project distribution analysis
 * - Visibility determination based on performance state
 * - Performance warning generation
 * 
 * @module PerformanceMetricsService
 */

import { PERFORMANCE_LIMITS } from '@/constants/performance';
import { trackMemoryUsage } from '@/lib/performanceUtils';
import type { Project, Group, CalendarEvent, Holiday } from '@/types';

/**
 * Interface for current system usage metrics
 */
export interface UsageMetrics {
  projects: number;
  groups: number;
  events: number;
  holidays: number;
}

/**
 * Interface for memory usage information
 */
export interface MemoryUsageInfo {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * Interface for performance analysis results
 */
export interface PerformanceAnalysis {
  usage: UsageMetrics;
  maxProjectsInGroup: number;
  memoryUsage: MemoryUsageInfo | null;
  shouldShowStatus: boolean;
  warnings: PerformanceWarning[];
}

/**
 * Interface for performance warnings
 */
export interface PerformanceWarning {
  type: 'project_limit' | 'group_limit' | 'memory_limit' | 'general';
  severity: 'low' | 'medium' | 'high';
  message: string;
  threshold: number;
  current: number;
}

/**
 * Calculate current usage metrics across all data entities
 * 
 * @param projects - Array of projects
 * @param groups - Array of groups
 * @param events - Array of events
 * @param holidays - Array of holidays
 * @returns Current usage metrics
 */
export function calculateUsageMetrics(
  projects: Project[],
  groups: Group[],
  events: CalendarEvent[],
  holidays: Holiday[]
): UsageMetrics {
  return {
    projects: projects.length,
    groups: groups.length,
    events: events.length,
    holidays: holidays.length
  };
}

/**
 * Calculate the maximum number of projects in any single group
 * 
 * @param projects - Array of projects
 * @param groups - Array of groups
 * @returns Maximum projects in any group
 */
export function calculateMaxProjectsInGroup(
  projects: Project[],
  groups: Group[]
): number {
  if (groups.length === 0) return 0;
  
  return Math.max(
    ...groups.map(group => 
      projects.filter(p => p.groupId === group.id).length
    ),
    0
  );
}

/**
 * Get memory usage information with percentage calculation
 * 
 * @returns Memory usage info or null if not available
 */
export function getMemoryUsageInfo(): MemoryUsageInfo | null {
  const memoryUsage = trackMemoryUsage();
  
  if (!memoryUsage) return null;
  
  return {
    used: memoryUsage.used,
    limit: memoryUsage.limit,
    percentage: (memoryUsage.used / memoryUsage.limit) * 100
  };
}

/**
 * Determine if performance status should be visible
 * 
 * @param maxProjectsInGroup - Maximum projects in any group
 * @param groupCount - Total number of groups
 * @returns Whether to show performance status
 */
export function shouldShowPerformanceStatus(
  maxProjectsInGroup: number,
  groupCount: number
): boolean {
  // Always show in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Show if approaching project limit per group (80% threshold)
  const projectLimitThreshold = PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP * 0.8;
  if (maxProjectsInGroup > projectLimitThreshold) {
    return true;
  }
  
  // Show if approaching group limit (80% threshold)
  const groupLimitThreshold = PERFORMANCE_LIMITS.MAX_GROUPS * 0.8;
  if (groupCount > groupLimitThreshold) {
    return true;
  }
  
  return false;
}

/**
 * Generate performance warnings based on current metrics
 * 
 * @param maxProjectsInGroup - Maximum projects in any group
 * @param groupCount - Total number of groups
 * @param memoryUsage - Memory usage information
 * @returns Array of performance warnings
 */
export function generatePerformanceWarnings(
  maxProjectsInGroup: number,
  groupCount: number,
  memoryUsage: MemoryUsageInfo | null
): PerformanceWarning[] {
  const warnings: PerformanceWarning[] = [];
  
  // Check project limit per group (90% threshold for warning)
  const projectWarningThreshold = PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP * 0.9;
  if (maxProjectsInGroup > projectWarningThreshold) {
    warnings.push({
      type: 'project_limit',
      severity: 'medium',
      message: '⚠ Approaching project limit - consider organizing into more groups',
      threshold: PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP,
      current: maxProjectsInGroup
    });
  }
  
  // Check group limit (90% threshold for warning)
  const groupWarningThreshold = PERFORMANCE_LIMITS.MAX_GROUPS * 0.9;
  if (groupCount > groupWarningThreshold) {
    warnings.push({
      type: 'group_limit',
      severity: 'medium',
      message: '⚠ Approaching group limit - consider consolidating groups',
      threshold: PERFORMANCE_LIMITS.MAX_GROUPS,
      current: groupCount
    });
  }
  
  // Check memory usage (85% threshold for warning)
  if (memoryUsage && memoryUsage.percentage > 85) {
    warnings.push({
      type: 'memory_limit',
      severity: memoryUsage.percentage > 95 ? 'high' : 'medium',
      message: `⚠ High memory usage: ${memoryUsage.percentage.toFixed(1)}%`,
      threshold: memoryUsage.limit,
      current: memoryUsage.used
    });
  }
  
  return warnings;
}

/**
 * Perform comprehensive performance analysis
 * 
 * @param projects - Array of projects
 * @param groups - Array of groups
 * @param events - Array of events
 * @param holidays - Array of holidays
 * @returns Complete performance analysis
 */
export function analyzePerformance(
  projects: Project[],
  groups: Group[],
  events: CalendarEvent[],
  holidays: Holiday[]
): PerformanceAnalysis {
  const usage = calculateUsageMetrics(projects, groups, events, holidays);
  const maxProjectsInGroup = calculateMaxProjectsInGroup(projects, groups);
  const memoryUsage = getMemoryUsageInfo();
  const shouldShowStatus = shouldShowPerformanceStatus(maxProjectsInGroup, usage.groups);
  const warnings = generatePerformanceWarnings(maxProjectsInGroup, usage.groups, memoryUsage);
  
  return {
    usage,
    maxProjectsInGroup,
    memoryUsage,
    shouldShowStatus,
    warnings
  };
}

/**
 * Get performance limit information for display
 * 
 * @returns Performance limits configuration
 */
export function getPerformanceLimits() {
  return {
    maxProjectsPerGroup: PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP,
    maxGroups: PERFORMANCE_LIMITS.MAX_GROUPS,
    // Add other limits as they become available
  };
}

/**
 * Calculate performance score (0-100) based on current usage
 * 
 * @param projects - Array of projects
 * @param groups - Array of groups
 * @param events - Array of events
 * @param holidays - Array of holidays
 * @returns Performance score from 0 (poor) to 100 (excellent)
 */
export function calculatePerformanceScore(
  projects: Project[],
  groups: Group[],
  events: CalendarEvent[],
  holidays: Holiday[]
): number {
  const usage = calculateUsageMetrics(projects, groups, events, holidays);
  const maxProjectsInGroup = calculateMaxProjectsInGroup(projects, groups);
  const memoryUsage = getMemoryUsageInfo();
  
  let score = 100;
  
  // Deduct points for high project concentration
  const projectUtilization = maxProjectsInGroup / PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP;
  score -= Math.max(0, (projectUtilization - 0.7) * 100);
  
  // Deduct points for high group utilization
  const groupUtilization = usage.groups / PERFORMANCE_LIMITS.MAX_GROUPS;
  score -= Math.max(0, (groupUtilization - 0.7) * 100);
  
  // Deduct points for high memory usage
  if (memoryUsage) {
    const memoryUtilization = memoryUsage.percentage / 100;
    score -= Math.max(0, (memoryUtilization - 0.7) * 150);
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get recommendations for performance optimization
 * 
 * @param analysis - Performance analysis results
 * @returns Array of optimization recommendations
 */
export function getOptimizationRecommendations(
  analysis: PerformanceAnalysis
): string[] {
  const recommendations: string[] = [];
  
  // Project distribution recommendations
  if (analysis.maxProjectsInGroup > PERFORMANCE_LIMITS.MAX_PROJECTS_PER_GROUP * 0.8) {
    recommendations.push(
      'Consider creating additional groups to distribute projects more evenly'
    );
  }
  
  // Group management recommendations
  if (analysis.usage.groups > PERFORMANCE_LIMITS.MAX_GROUPS * 0.8) {
    recommendations.push(
      'Review group structure and consider consolidating similar groups'
    );
  }
  
  // Memory optimization recommendations
  if (analysis.memoryUsage && analysis.memoryUsage.percentage > 80) {
    recommendations.push(
      'High memory usage detected - consider archiving old projects or events'
    );
  }
  
  // Data cleanup recommendations
  if (analysis.usage.events > 1000) {
    recommendations.push(
      'Large number of events detected - consider archiving completed events'
    );
  }
  
  if (analysis.usage.holidays > 100) {
    recommendations.push(
      'Consider reviewing holiday configuration for optimization'
    );
  }
  
  return recommendations;
}
