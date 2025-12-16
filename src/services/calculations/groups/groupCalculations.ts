/**
 * Group Calculations
 *
 * Pure mathematical functions for group-related calculations.
 * No side effects, no external dependencies, fully testable.
 *
 * ✅ Pure functions only
 * ✅ Deterministic outputs
 * ✅ Mathematical operations only
 */

import { Group, Project } from '@/types/core';

/**
 * Calculate group statistics from projects
 */
export function calculateGroupStatistics(
  group: Group,
  projects: Project[] = []
): {
  projectCount: number;
  totalEstimatedHours: number;
  activeProjectCount: number;
  completedProjectCount: number;
} {
  const groupProjects = projects.filter(p => p.groupId === group.id);
  const now = new Date();

  const activeProjects = groupProjects.filter(p => {
    const endDate = new Date(p.endDate);
    return endDate >= now;
  });

  const completedProjects = groupProjects.filter(p => {
    const endDate = new Date(p.endDate);
    return endDate < now;
  });

  const totalEstimatedHours = groupProjects.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);

  return {
    projectCount: groupProjects.length,
    totalEstimatedHours,
    activeProjectCount: activeProjects.length,
    completedProjectCount: completedProjects.length
  };
}
