import type { Project } from '@/types';
import { formatDateShort } from '@/utils/dateFormatUtils';

/**
 * Project Status Calculations
 * Handles project status determination and organization based on dates
 */

/**
 * Calculate project status based on dates and continuous flag
 */
export function calculateProjectStatus(project: Project): {
  isOverdue: boolean;
  isActive: boolean;
  status: 'upcoming' | 'active' | 'completed' | 'overdue';
  daysUntilDue?: number;
} {
  if (!project.startDate || !project.endDate) {
    return {
      isOverdue: false,
      isActive: false,
      status: 'upcoming'
    };
  }

  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  const now = new Date();

  const isOverdue = end < now && !project.continuous;
  const isActive = start <= now && (end >= now || project.continuous);

  let status: 'upcoming' | 'active' | 'completed' | 'overdue';
  let daysUntilDue: number | undefined;

  if (isOverdue) {
    status = 'overdue';
  } else if (isActive) {
    status = 'active';
  } else if (start > now) {
    status = 'upcoming';
  } else {
    status = 'completed';
  }

  // Calculate days until due for active projects
  if (status === 'active' && !project.continuous) {
    const timeDiff = end.getTime() - now.getTime();
    daysUntilDue = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  return {
    isOverdue,
    isActive,
    status,
    daysUntilDue
  };
}

/**
 * Format project date range for display
 */
export function formatProjectDateRange(project: Project): string {
  if (!project.startDate || !project.endDate) return '';

  const start = new Date(project.startDate);
  const end = new Date(project.endDate);

  const startFormatted = formatDateShort(start);

  if (project.continuous) {
    return `${startFormatted} - ongoing`;
  }

  // If same year, don't repeat year
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const endFormatted = startYear === endYear ? formatDateShort(end) : end.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Determines project status as 'future', 'current', or 'archived' based on dates
 * - 'future': Project hasn't started yet (startDate is in the future)
 * - 'current': Project is running (today is between startDate and endDate)
 * - 'archived': Project has ended (endDate is in the past)
 */
export function determineProjectStatus(project: Project): 'future' | 'current' | 'archived' {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today for accurate comparison

  const startDate = project.startDate ? new Date(project.startDate) : null;
  const endDate = project.endDate ? new Date(project.endDate) : null;

  // Set time to start of day for accurate comparison
  if (startDate) {
    startDate.setHours(0, 0, 0, 0);
  }
  if (endDate) {
    endDate.setHours(0, 0, 0, 0);
  }

  // If project has ended, it's archived
  if (endDate && endDate < today) {
    return 'archived';
  }

  // If project hasn't started yet, it's future
  if (startDate && startDate > today) {
    return 'future';
  }

  // If project is running (today is between start and end dates, or no end date), it's current
  return 'current';
}

/**
 * Gets the effective status for a project, using automatic determination if no status is set
 */
export function getEffectiveProjectStatus(project: Project): 'future' | 'current' | 'archived' {
  // Always determine status based on dates, ignore any manually set status
  return determineProjectStatus(project);
}

/**
 * Organizes projects by their effective status
 */
export function organizeProjectsByStatus(projects: Project[]) {
  const organized = {
    current: [] as Project[],
    future: [] as Project[],
    archived: [] as Project[]
  };

  projects.forEach(project => {
    const status = getEffectiveProjectStatus(project);
    organized[status].push(project);
  });

  return organized;
}
