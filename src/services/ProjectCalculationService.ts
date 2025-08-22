/**
 * Project Time Calculation Service
 * Handles all project duration, milestone, and resource calculations
 */

import { DateCalculationService } from './DateCalculationService';

interface Project {
  id: string;
  startDate: string;
  endDate: string;
  estimated_hours: number;
}

interface Milestone {
  id: string;
  project_id: string;
  time_allocation: number; // in hours
  due_date?: string;
}

interface WorkSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

interface Settings {
  weeklyWorkHours: {
    monday: WorkSlot[];
    tuesday: WorkSlot[];
    wednesday: WorkSlot[];
    thursday: WorkSlot[];
    friday: WorkSlot[];
    saturday: WorkSlot[];
    sunday: WorkSlot[];
  };
}

export interface ProjectTimeMetrics {
  totalDays: number;
  businessDays: number;
  dailyHours: number;
  weeklyHours: number;
  isOverAllocated: boolean;
  utilizationRate: number;
  endDateProjection: Date;
}

export class ProjectCalculationService {
  /**
   * Calculate comprehensive project time metrics
   */
  static calculateProjectMetrics(
    project: Project, 
    settings: Settings, 
    holidays: Date[] = []
  ): ProjectTimeMetrics {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    
    // Date calculations
    const totalDays = DateCalculationService.getBusinessDaysBetween(startDate, endDate, holidays);
    const businessDays = DateCalculationService.getBusinessDaysBetween(startDate, endDate, holidays);
    
    // Work capacity calculations
    const dailyWorkCapacity = this.calculateDailyWorkCapacity(settings);
    const weeklyWorkCapacity = this.calculateWeeklyWorkCapacity(settings);
    
    // Project load calculations
    const dailyHours = project.estimated_hours / businessDays;
    const weeklyHours = dailyHours * 5; // Assuming 5 business days per week
    
    // Utilization analysis
    const utilizationRate = dailyHours / dailyWorkCapacity;
    const isOverAllocated = utilizationRate > 1;
    
    // End date projection based on work capacity
    const endDateProjection = this.calculateProjectEndDate(
      startDate, 
      project.estimated_hours, 
      settings, 
      holidays
    );

    return {
      totalDays,
      businessDays,
      dailyHours,
      weeklyHours,
      isOverAllocated,
      utilizationRate,
      endDateProjection
    };
  }

  /**
   * Calculate milestone allocation metrics
   */
  static calculateMilestoneMetrics(milestones: Milestone[], projectBudget: number) {
    const totalAllocated = milestones.reduce((sum, milestone) => sum + milestone.time_allocation, 0);
    const remainingBudget = projectBudget - totalAllocated;
    const budgetUtilization = totalAllocated / projectBudget;
    
    const milestoneBreakdown = milestones.map(milestone => ({
      id: milestone.id,
      hours: milestone.time_allocation,
      percentage: (milestone.time_allocation / projectBudget) * 100,
      isValid: milestone.time_allocation > 0 && milestone.time_allocation <= projectBudget
    }));

    return {
      totalAllocated,
      remainingBudget,
      budgetUtilization,
      isOverBudget: totalAllocated > projectBudget,
      isUnderBudget: totalAllocated < projectBudget,
      milestoneBreakdown
    };
  }

  /**
   * Calculate daily work capacity from settings
   */
  static calculateDailyWorkCapacity(settings: Settings): number {
    const weeklyHours = Object.values(settings.weeklyWorkHours);
    const totalWeeklyHours = weeklyHours.reduce((total, daySlots) => {
      const dayTotal = daySlots.reduce((daySum, slot) => daySum + slot.duration, 0);
      return total + dayTotal;
    }, 0);
    
    return totalWeeklyHours / 5; // Average daily capacity
  }

  /**
   * Calculate weekly work capacity from settings
   */
  static calculateWeeklyWorkCapacity(settings: Settings): number {
    const weeklyHours = Object.values(settings.weeklyWorkHours);
    return weeklyHours.reduce((total, daySlots) => {
      const dayTotal = daySlots.reduce((daySum, slot) => daySum + slot.duration, 0);
      return total + dayTotal;
    }, 0);
  }

  /**
   * Calculate when a project will actually end based on work capacity
   */
  static calculateProjectEndDate(
    startDate: Date, 
    totalHours: number, 
    settings: Settings, 
    holidays: Date[] = []
  ): Date {
    const dailyCapacity = this.calculateDailyWorkCapacity(settings);
    let remainingHours = totalHours;
    let currentDate = new Date(startDate);
    
    while (remainingHours > 0) {
      const businessDays = DateCalculationService.getBusinessDaysInRange(
        currentDate, 
        new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Next week
        holidays
      );
      
      for (const businessDay of businessDays) {
        if (remainingHours <= 0) break;
        
        const dayCapacity = this.getDayWorkCapacity(businessDay, settings);
        remainingHours -= Math.min(remainingHours, dayCapacity);
        currentDate = businessDay;
      }
      
      if (remainingHours > 0) {
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }
    
    return currentDate;
  }

  /**
   * Get work capacity for a specific day
   */
  private static getDayWorkCapacity(date: Date, settings: Settings): number {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof Settings['weeklyWorkHours'];
    
    const daySlots = settings.weeklyWorkHours[dayName];
    return daySlots.reduce((total, slot) => total + slot.duration, 0);
  }

  /**
   * Calculate project overlap analysis
   */
  static calculateProjectOverlaps(projects: Project[]): Array<{
    project1: string;
    project2: string;
    overlapDays: number;
    overlapPercentage: number;
  }> {
    const overlaps: Array<{
      project1: string;
      project2: string;
      overlapDays: number;
      overlapPercentage: number;
    }> = [];

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const project1 = projects[i];
        const project2 = projects[j];
        
        const range1 = { 
          start: new Date(project1.startDate), 
          end: new Date(project1.endDate) 
        };
        const range2 = { 
          start: new Date(project2.startDate), 
          end: new Date(project2.endDate) 
        };
        
        const overlap = DateCalculationService.getDateRangeOverlap(range1, range2);
        
        if (overlap) {
          const overlapDays = DateCalculationService.getBusinessDaysBetween(overlap.start, overlap.end);
          const project1Days = DateCalculationService.getBusinessDaysBetween(range1.start, range1.end);
          const overlapPercentage = (overlapDays / project1Days) * 100;
          
          overlaps.push({
            project1: project1.id,
            project2: project2.id,
            overlapDays,
            overlapPercentage
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Validate milestone timeline feasibility
   */
  static validateMilestoneTimeline(
    milestones: Milestone[], 
    project: Project, 
    settings: Settings
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    // Check if milestones fit within project timeline
    for (const milestone of milestones) {
      if (milestone.due_date) {
        const dueDate = new Date(milestone.due_date);
        if (dueDate < projectStart || dueDate > projectEnd) {
          issues.push(`Milestone "${milestone.id}" due date is outside project timeline`);
        }
      }
    }
    
    // Check budget allocation
    const milestoneMetrics = this.calculateMilestoneMetrics(milestones, project.estimated_hours);
    if (milestoneMetrics.isOverBudget) {
      issues.push(`Total milestone allocation (${milestoneMetrics.totalAllocated}h) exceeds project budget (${project.estimated_hours}h)`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
