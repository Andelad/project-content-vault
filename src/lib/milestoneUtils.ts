import { Milestone } from '@/types/core';
import { MilestoneManagementService } from '@/services/milestoneManagementService';

/**
 * Calculate daily time allocation for milestones
 * Distributes milestone hours across the days between milestones
 */
export function calculateMilestoneTimeDistribution(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): { date: Date; estimatedHours: number; milestone?: Milestone }[] {
  if (milestones.length === 0) {
    return [];
  }

  // Sort milestones by due date
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const result: { date: Date; estimatedHours: number; milestone?: Milestone }[] = [];
  let currentDate = new Date(projectStartDate);
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedMilestones.length; i++) {
    const milestone = sortedMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    // Calculate days between current date and milestone
    const timeDiff = milestoneDate.getTime() - currentDate.getTime();
    const daysDiff = Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    // Distribute milestone hours across the days
    const hoursPerDay = milestone.timeAllocation / daysDiff;

    // Add entries for each day leading up to the milestone
    for (let day = 0; day < daysDiff; day++) {
      const dayDate = new Date(currentDate.getTime() + (day * 24 * 60 * 60 * 1000));
      const isLastDay = day === daysDiff - 1;
      
      result.push({
        date: dayDate,
        estimatedHours: hoursPerDay,
        milestone: isLastDay ? milestone : undefined
      });
    }

    // Move current date to the day after this milestone
    currentDate = new Date(milestoneDate.getTime() + (24 * 60 * 60 * 1000));
  }

  return result;
}

/**
 * Get total estimated hours for a specific date based on milestone distribution
 */
export function getEstimatedHoursForDate(
  date: Date,
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): number {
  const distribution = calculateMilestoneTimeDistribution(milestones, projectStartDate, projectEndDate);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const entry = distribution.find(d => d.date.getTime() === targetDate.getTime());
  return entry ? entry.estimatedHours : 0;
}

/**
 * Get milestone that is due on a specific date
 */
export function getMilestoneForDate(
  date: Date,
  milestones: Milestone[]
): Milestone | undefined {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return milestones.find(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);
    return milestoneDate.getTime() === targetDate.getTime();
  });
}

// Backward compatibility functions for milestone management
// @deprecated Use MilestoneManagementService instead

/**
 * @deprecated Use MilestoneManagementService.calculateMilestoneDateRange
 */
export function calculateMilestoneDateRange(
  projectStartDate: Date,
  projectEndDate: Date,
  existingMilestones: Milestone[],
  currentMilestone?: Milestone
) {
  console.warn('calculateMilestoneDateRange is deprecated. Use MilestoneManagementService.calculateMilestoneDateRange instead.');
  return MilestoneManagementService.calculateMilestoneDateRange({
    projectStartDate,
    projectEndDate,
    existingMilestones,
    currentMilestone
  });
}

/**
 * @deprecated Use MilestoneManagementService.calculateDefaultMilestoneDate
 */
export function calculateDefaultMilestoneDate(
  projectStartDate: Date,
  projectEndDate: Date,
  existingMilestones: Milestone[]
) {
  console.warn('calculateDefaultMilestoneDate is deprecated. Use MilestoneManagementService.calculateDefaultMilestoneDate instead.');
  return MilestoneManagementService.calculateDefaultMilestoneDate({
    projectStartDate,
    projectEndDate,
    existingMilestones
  });
}

/**
 * @deprecated Use MilestoneManagementService.generateOrdinalNumber
 */
export function getOrdinalNumber(num: number): string {
  console.warn('getOrdinalNumber is deprecated. Use MilestoneManagementService.generateOrdinalNumber instead.');
  return MilestoneManagementService.generateOrdinalNumber(num);
}

// Re-export the service for convenience
export { MilestoneManagementService };
