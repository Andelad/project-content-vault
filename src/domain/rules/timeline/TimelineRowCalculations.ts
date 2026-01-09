/**
 * Timeline Row Arrangement Calculations
 * 
 * Pure algorithmic logic for arranging projects into visual rows based on date overlaps.
 * Uses greedy algorithm with minimum gap enforcement between projects on the same row.
 * 
 * Following AI Development Rules:
 * - Pure calculations (no side effects, no state, no database access)
 * - No business context - just date overlap math
 * - Could run on server with zero business knowledge
 */

import type { Project, Group } from '@/shared/types/core';

const ROW_HEIGHT = 52; // pixels - matches current timeline row height
const MIN_GAP_DAYS = 2; // minimum days between projects on same row

export interface VisualRow {
  rowNumber: number;
  projects: Project[];
  height: number;
}

export interface GroupLayout {
  groupId: string;
  groupName: string;
  visualRows: VisualRow[];
  totalHeight: number;
}

export interface TimelineLayout {
  groups: GroupLayout[];
  dateRange: { start: Date; end: Date };
}

export interface TimelineAutoRowInput {
  projects: Project[];
  groups: Group[];
  dateRange: { start: Date; end: Date };
  sortBy?: 'startDate' | 'alphabetical';
  minGapDays?: number;
}

/**
 * Calculate days between two dates (end to start)
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * Check if two projects overlap with minimum gap requirement
 * CRITICAL: Continuous projects are treated as having no end date
 */
function projectsOverlap(p1: Project, p2: Project, minGap: number): boolean {
  // If p1 is continuous, it extends indefinitely and always conflicts with any project after it
  if (p1.continuous) {
    return true;
  }
  
  // If p2 is continuous, check if it starts before p1 ends (with gap)
  if (p2.continuous) {
    const gap = daysBetween(p1.endDate, p2.startDate);
    return gap < minGap;
  }
  
  // Both projects have end dates - calculate gap from p1 end to p2 start
  const gap = daysBetween(p1.endDate, p2.startDate);
  return gap < minGap;
}

/**
 * Check if project dates overlap with visible date range
 */
function isProjectVisible(project: Project, dateRange: { start: Date; end: Date }): boolean {
  const projectStart = new Date(project.startDate);
  const rangeEnd = dateRange.end;

  // For continuous projects, they're visible as long as they've started
  if (project.continuous) {
    return projectStart <= rangeEnd;
  }

  // For non-continuous projects, check both start and end dates
  const projectEnd = new Date(project.endDate);
  return projectStart <= rangeEnd && projectEnd >= dateRange.start;
}

/**
 * Sort projects by start date (primary) and name (secondary)
 */
function sortProjects(projects: Project[], sortBy: 'startDate' | 'alphabetical' = 'startDate'): Project[] {
  return [...projects].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    
    // Sort by start date (primary)
    const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    
    // If same start date, sort alphabetically (secondary)
    return a.name.localeCompare(b.name);
  });
}

/**
 * Assign projects to visual rows using greedy algorithm
 * 
 * Algorithm:
 * 1. Sort projects by start date
 * 2. For each project, try to place in existing row
 * 3. If no existing row works (all have conflicts), create new row
 * 4. Projects are placed left-to-right with minimum gap enforcement
 */
function assignProjectsToRows(projects: Project[], minGapDays: number): VisualRow[] {
  const visualRows: VisualRow[] = [];
  
  for (const project of projects) {
    let placed = false;
    
    // Try to place in existing rows
    for (const row of visualRows) {
      if (row.projects.length === 0) {
        // Empty row, always safe
        row.projects.push(project);
        placed = true;
        break;
      }
      
      // Check if project fits after all projects in this row
      const lastProject = row.projects[row.projects.length - 1];
      
      if (!projectsOverlap(lastProject, project, minGapDays)) {
        // No overlap with minimum gap, safe to place
        row.projects.push(project);
        placed = true;
        break;
      }
    }
    
    // Create new row if needed
    if (!placed) {
      visualRows.push({
        rowNumber: visualRows.length,
        projects: [project],
        height: ROW_HEIGHT
      });
    }
  }
  
  return visualRows;
}

/**
 * Calculate layout for a single group
 */
function calculateGroupLayout(
  group: Group,
  projects: Project[],
  dateRange: { start: Date; end: Date },
  sortBy: 'startDate' | 'alphabetical',
  minGapDays: number
): GroupLayout {
  // Filter projects for this group and visible date range
  const groupProjects = projects.filter(
    p => p.groupId === group.id && isProjectVisible(p, dateRange)
  );
  
  // Sort projects
  const sortedProjects = sortProjects(groupProjects, sortBy);
  
  // Assign to visual rows
  const visualRows = assignProjectsToRows(sortedProjects, minGapDays);
  
  // Calculate total height
  const totalHeight = visualRows.length * ROW_HEIGHT;
  
  return {
    groupId: group.id,
    groupName: group.name,
    visualRows,
    totalHeight
  };
}

/**
 * Main function: Calculate complete timeline row arrangement
 * 
 * Automatically arranges projects into visual rows within groups based on date overlaps.
 * - Projects sorted by start date (primary) or alphabetically (secondary)
 * - Minimum 2-day gap enforced between projects on the same visual row
 * - Dynamic row count based on concurrent projects in visible date range
 */
export function calculateTimelineRows(input: TimelineAutoRowInput): TimelineLayout {
  const {
    projects,
    groups,
    dateRange,
    sortBy = 'startDate',
    minGapDays = MIN_GAP_DAYS
  } = input;
  
  // Calculate layout for each group
  const groupLayouts = groups.map(group =>
    calculateGroupLayout(group, projects, dateRange, sortBy, minGapDays)
  );
  
  return {
    groups: groupLayouts,
    dateRange
  };
}

/**
 * Get project's assigned visual row number within a group layout
 */
export function getProjectVisualRow(projectId: string, groupLayout: GroupLayout): number | null {
  for (let i = 0; i < groupLayout.visualRows.length; i++) {
    const row = groupLayout.visualRows[i];
    if (row.projects.some(p => p.id === projectId)) {
      return i;
    }
  }
  return null;
}

/**
 * Calculate layout metrics for debugging/monitoring
 */
export function calculateLayoutMetrics(layout: TimelineLayout) {
  const totalProjects = layout.groups.reduce(
    (sum, group) => sum + group.visualRows.reduce((s, row) => s + row.projects.length, 0),
    0
  );
  
  const totalRows = layout.groups.reduce(
    (sum, group) => sum + group.visualRows.length,
    0
  );
  
  const maxRowsInGroup = Math.max(
    ...layout.groups.map(g => g.visualRows.length),
    0
  );
  
  const avgProjectsPerRow = totalRows > 0 ? totalProjects / totalRows : 0;
  
  return {
    totalProjects,
    totalRows,
    maxRowsInGroup,
    avgProjectsPerRow,
    groupCount: layout.groups.length
  };
}

// Export constants for use by components
export const TIMELINE_AUTO_LAYOUT_CONSTANTS = {
  ROW_HEIGHT,
  MIN_GAP_DAYS,
  GROUP_HEADER_HEIGHT: 32, // pixels
  ADD_PROJECT_ROW_HEIGHT: 36 // pixels
};
