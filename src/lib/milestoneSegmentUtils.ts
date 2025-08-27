import { Milestone } from '@/types/core';
import { calculateWorkHourCapacity } from './workHoursUtils';
import { HeightCalculationService } from '@/services';

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
  isWorkingDay: (date: Date) => boolean,
  events: any[] = [],
  projectTotalBudget?: number,
  workHours?: any[]
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

    // Segment end date is the milestone date itself (work happens up TO and INCLUDING the milestone)
    const segmentEndDate = new Date(milestoneDate);

    // Calculate working days in this segment (including milestone day)
    const workingDays = calculateWorkingDaysInRange(
      currentStartDate,
      segmentEndDate,
      isWorkingDay,
      holidays,
      workHours
    );

    // Calculate total planned time in this segment
    const plannedTimeInSegment = calculatePlannedTimeInSegment(
      projectId,
      currentStartDate,
      segmentEndDate,
      events
    );

    // Subtract planned time from milestone budget for auto-estimate
    const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);

    // Calculate hours per day and visual height
    const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;
    const heightInPixels = HeightCalculationService.calculateSegmentHeight(hoursPerDay);

    // Debug logging
    console.log(`🎯 Milestone ${milestone.id} calculation for project ${projectId}:`, {
      milestoneAllocation: milestone.timeAllocation,
      plannedTimeInSegment,
      remainingBudget,
      workingDays,
      hoursPerDay: hoursPerDay.toFixed(2),
      expectedHoursPerDay: workingDays > 0 ? (milestone.timeAllocation / workingDays).toFixed(2) : '0',
      startDate: currentStartDate.toDateString(),
      endDate: segmentEndDate.toDateString(),
      milestoneDate: milestoneDate.toDateString()
    });

    segments.push({
      id: `segment-${milestone.id}`,
      startDate: new Date(currentStartDate),
      endDate: new Date(segmentEndDate),
      milestone,
      allocatedHours: milestone.timeAllocation,
      workingDays,
      hoursPerDay,
      heightInPixels
    });

    // Move to next segment start (day after milestone date)
    currentStartDate = new Date(milestoneDate);
    currentStartDate.setDate(milestoneDate.getDate() + 1);
  }

  // Calculate remaining time after last milestone
  if (projectTotalBudget !== undefined && projectMilestones.length > 0) {
    const lastMilestone = projectMilestones[projectMilestones.length - 1];
    const lastMilestoneDate = new Date(lastMilestone.dueDate);
    lastMilestoneDate.setHours(0, 0, 0, 0);
    
    // Start from the day after the last milestone
    const remainingStartDate = new Date(lastMilestoneDate);
    remainingStartDate.setDate(lastMilestoneDate.getDate() + 1);
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    // Only create remaining segment if there are days between last milestone and project end
    if (remainingStartDate <= projectEnd) {
      // Calculate total milestone allocations
      const totalMilestoneAllocations = projectMilestones.reduce(
        (sum, m) => sum + m.timeAllocation, 0
      );
      
      // Calculate remaining budget
      const remainingBudget = Math.max(0, projectTotalBudget - totalMilestoneAllocations);
      
      console.log(`📊 Remaining time calculation for project ${projectId}:`, {
        projectTotalBudget,
        totalMilestoneAllocations,
        remainingBudget,
        remainingStartDate: remainingStartDate.toDateString(),
        projectEndDate: projectEnd.toDateString()
      });
      
      if (remainingBudget > 0) {
        // Calculate working days in remaining period
        const remainingWorkingDays = calculateWorkingDaysInRange(
          remainingStartDate,
          projectEnd,
          isWorkingDay,
          holidays,
          workHours
        );

        // Calculate total planned time in remaining segment
        const remainingPlannedTime = calculatePlannedTimeInSegment(
          projectId,
          remainingStartDate,
          projectEnd,
          events
        );

        // Subtract planned time from remaining budget for auto-estimate
        const remainingAutoEstimateBudget = Math.max(0, remainingBudget - remainingPlannedTime);

        // Calculate hours per day and visual height for remaining time
        const remainingHoursPerDay = remainingWorkingDays > 0 ? remainingAutoEstimateBudget / remainingWorkingDays : 0;
        const remainingHeightInPixels = HeightCalculationService.calculateSegmentHeight(remainingHoursPerDay);

        console.log(`🏁 Remaining segment calculation for project ${projectId}:`, {
          remainingBudget,
          remainingPlannedTime,
          remainingAutoEstimateBudget,
          remainingWorkingDays,
          remainingHoursPerDay: remainingHoursPerDay.toFixed(2)
        });

        segments.push({
          id: `segment-remaining-${projectId}`,
          startDate: new Date(remainingStartDate),
          endDate: new Date(projectEnd),
          milestone: undefined, // No specific milestone - this represents remaining budget after all milestones
          allocatedHours: remainingBudget,
          workingDays: remainingWorkingDays,
          hoursPerDay: remainingHoursPerDay,
          heightInPixels: remainingHeightInPixels
        });
      }
    }
  }

  return segments;
}

/**
 * Calculate total planned time for a project in a specific date range
 */
function calculatePlannedTimeInSegment(
  projectId: string,
  startDate: Date,
  endDate: Date,
  events: any[]
): number {
  let totalPlannedHours = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    // Find events for this project on this date
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);
      const currentDay = new Date(current);
      currentDay.setHours(0, 0, 0, 0);
      
      return event.projectId === projectId && 
             eventDate.getTime() === currentDay.getTime();
    });

    // Sum up the duration of events for this day
    for (const event of dayEvents) {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      totalPlannedHours += durationHours;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return totalPlannedHours;
}

/**
 * Calculate working days in a date range, excluding holidays and non-working days
 */
function calculateWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  isWorkingDay: (date: Date) => boolean,
  holidays: any[],
  workHours?: any[]
): number {
  let workingDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    let hasWorkHours = false;
    
    if (workHours) {
      // Use actual work hours to determine if this date has work time
      // Use local date string to avoid timezone issues
      const currentDateString = current.getFullYear() + '-' + 
        String(current.getMonth() + 1).padStart(2, '0') + '-' + 
        String(current.getDate()).padStart(2, '0');
      
      const dayWorkHours = workHours.filter(wh => {
        // Handle both Date objects and ISO strings for startTime
        const whDate = wh.startTime instanceof Date ? wh.startTime : new Date(wh.startTime);
        // Use local date string for work hours too
        const whDateString = whDate.getFullYear() + '-' + 
          String(whDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(whDate.getDate()).padStart(2, '0');
        return whDateString === currentDateString;
      });
      
      // Calculate total work hours for this specific date
      const totalWorkHours = dayWorkHours.reduce((sum, wh) => sum + (wh.duration || 0), 0);
      hasWorkHours = totalWorkHours > 0;
      
      // Debug logging for work hours filtering
      console.log(`📅 Working day check for ${current.toDateString()}:`, {
        currentDateString,
        dayWorkHoursFound: dayWorkHours.length,
        totalWorkHours,
        hasWorkHours,
        sampleWorkHour: dayWorkHours[0] ? {
          startTime: dayWorkHours[0].startTime,
          duration: dayWorkHours[0].duration
        } : 'none'
      });
    } else {
      // Fallback to general working day function
      hasWorkHours = isWorkingDay(current);
    }
    
    if (hasWorkHours) {
      // Check if this date is not a holiday
      const isHoliday = holidays.some(holiday => {
        const holidayStart = new Date(holiday.startDate);
        const holidayEnd = new Date(holiday.endDate);
        holidayStart.setHours(0, 0, 0, 0);
        holidayEnd.setHours(0, 0, 0, 0);
        const currentDay = new Date(current);
        currentDay.setHours(0, 0, 0, 0);
        return currentDay >= holidayStart && currentDay <= holidayEnd;
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
 * @deprecated Use HeightCalculationService.calculateSegmentHeight instead
 */
function calculateSegmentHeight(hoursPerDay: number): number {
  return HeightCalculationService.calculateSegmentHeight(hoursPerDay);
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
