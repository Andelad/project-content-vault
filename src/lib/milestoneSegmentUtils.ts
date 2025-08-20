import { Milestone } from '@/types/core';
import { calculateWorkHourCapacity } from './workHoursUtils';

export interface MilestoneSegment {
  id: string;
  startDate: Date;
  endDate: Date;
  milestone?: Milestone;
  allocatedHours: number;
  workingDays: number;
  hoursPerDay: number;
  heightInPixels: number;
}

/**
 * Calculate milestone segments with auto-estimate data
 * Divides project timeline into segments between milestones
 */
export function calculateMilestoneSegments(
  projectId: string,
  projectStartDate: Date,
  projectEndDate: Date,
  milestones: Milestone[],
  settings: any,
  holidays: any[],
  isWorkingDay: (date: Date) => boolean
): MilestoneSegment[] {
  // Filter and sort milestones for this project
  const projectMilestones = milestones
    .filter(m => m.projectId === projectId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (projectMilestones.length === 0) {
    return [];
  }

  const segments: MilestoneSegment[] = [];
  let currentStartDate = new Date(projectStartDate);
  currentStartDate.setHours(0, 0, 0, 0);

  // Create segments between milestones
  for (let i = 0; i < projectMilestones.length; i++) {
    const milestone = projectMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    // Calculate working days in this segment
    const workingDays = calculateWorkingDaysInRange(
      currentStartDate,
      milestoneDate,
      isWorkingDay,
      holidays
    );

    // Calculate hours per day and visual height
    const hoursPerDay = workingDays > 0 ? milestone.timeAllocation / workingDays : 0;
    const heightInPixels = calculateSegmentHeight(hoursPerDay);

    segments.push({
      id: `segment-${milestone.id}`,
      startDate: new Date(currentStartDate),
      endDate: new Date(milestoneDate),
      milestone,
      allocatedHours: milestone.timeAllocation,
      workingDays,
      hoursPerDay,
      heightInPixels
    });

    // Move to next segment start (day after milestone)
    currentStartDate = new Date(milestoneDate);
    currentStartDate.setDate(milestoneDate.getDate() + 1);
  }

  return segments;
}

/**
 * Calculate working days in a date range, excluding holidays and non-working days
 */
function calculateWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  isWorkingDay: (date: Date) => boolean,
  holidays: any[]
): number {
  let workingDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current)) {
      // Check if this date is not a holiday
      const isHoliday = holidays.some(holiday => {
        const holidayStart = new Date(holiday.startDate);
        const holidayEnd = new Date(holiday.endDate);
        holidayStart.setHours(0, 0, 0, 0);
        holidayEnd.setHours(0, 0, 0, 0);
        return current >= holidayStart && current <= holidayEnd;
      });
      
      if (!isHoliday) {
        workingDays++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Calculate visual height for segment based on hours per day
 */
function calculateSegmentHeight(hoursPerDay: number): number {
  if (hoursPerDay === 0) return 0;
  
  // Similar logic to project auto-estimate: minimum 3px, scale by hours
  const heightInPixels = Math.max(3, Math.round(hoursPerDay * 2));
  
  // Cap at 40px to stay within row height
  return Math.min(heightInPixels, 40);
}

/**
 * Get milestone segment that contains a specific date
 */
export function getMilestoneSegmentForDate(
  date: Date,
  segments: MilestoneSegment[]
): MilestoneSegment | null {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return segments.find(segment => {
    const segmentStart = new Date(segment.startDate);
    const segmentEnd = new Date(segment.endDate);
    segmentStart.setHours(0, 0, 0, 0);
    segmentEnd.setHours(0, 0, 0, 0);
    
    return targetDate >= segmentStart && targetDate <= segmentEnd;
  }) || null;
}
