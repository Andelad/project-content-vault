import { Project } from '@/types/core';

export interface ProjectStatus {
  isOverdue: boolean;
  isActive: boolean;
  status: 'active' | 'overdue' | 'upcoming' | 'completed';
  daysUntilDue?: number;
}

/**
 * Calculate project status based on dates and continuous flag
 */
export const calculateProjectStatus = (project: Project): ProjectStatus => {
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

  let status: ProjectStatus['status'];
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
};

/**
 * Format project date range for display
 */
export const formatProjectDateRange = (project: Project): string => {
  if (!project.startDate || !project.endDate) return '';

  const start = new Date(project.startDate);
  const end = new Date(project.endDate);

  const startFormatted = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  if (project.continuous) {
    return `${startFormatted} - Ongoing`;
  }

  const endFormatted = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return `${startFormatted} - ${endFormatted}`;
};
