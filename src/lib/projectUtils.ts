import { Project, ProjectStatus } from '@/types/core';

/**
 * Determines the status of a project based on its start and end dates
 * - 'future': Project hasn't started yet (startDate is in the future)
 * - 'current': Project is running (today is between startDate and endDate)
 * - 'archived': Project has ended (endDate is in the past)
 */
export function determineProjectStatus(project: Project): ProjectStatus {
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
export function getEffectiveProjectStatus(project: Project): ProjectStatus {
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
