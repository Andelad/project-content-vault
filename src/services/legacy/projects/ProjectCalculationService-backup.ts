/**
 * Project Time Calculation Service
 * Handles all project duration, milestone, and resource calculations
 */

import { DateCalculationService } from '@/services/infrastructure/dateCalculationService';
import { calculateProjectDuration } from '../../calculations/projectProgressCalculations';
import { Project } from '@/types';

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
    const dailyHours = project.estimatedHours / businessDays;
    const weeklyHours = dailyHours * 5; // Assuming 5 business days per week
    
    // Utilization analysis
    const utilizationRate = dailyHours / dailyWorkCapacity;
    const isOverAllocated = utilizationRate > 1;
    
    // End date projection based on work capacity
    const endDateProjection = this.calculateProjectEndDate(
      startDate, 
      project.estimatedHours, 
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
    const milestoneMetrics = this.calculateMilestoneMetrics(milestones, project.estimatedHours);
    if (milestoneMetrics.isOverBudget) {
      issues.push(`Total milestone allocation (${milestoneMetrics.totalAllocated}h) exceeds project budget (${project.estimatedHours}h)`);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate default hours per day for a project
   */
  static getDefaultHoursPerDay(project: Project): number {
    const duration = calculateProjectDuration(project);
    return duration > 0 ? project.estimatedHours / duration : 0;
  }

  /**
   * Get project days that are visible in the current viewport
   */
  static getProjectDaysInViewport(project: Project, viewportStart: Date, viewportEnd: Date): Date[] {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    if (projectEnd < viewportStart || projectStart > viewportEnd) {
      return [];
    }

    const projectDays = [];
    const visibleStart = projectStart < viewportStart ? viewportStart : projectStart;
    const visibleEnd = projectEnd > viewportEnd ? viewportEnd : projectEnd;

    for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
      projectDays.push(new Date(d));
    }

    return projectDays;
  }

  /**
   * Calculate weekly work hours capacity (for reports)
   */
  static calculateWeeklyCapacity(settings: Settings): number {
    return Object.values(settings.weeklyWorkHours).reduce((sum, dayData) => {
      // Handle both old (number) and new (WorkSlot[]) formats
      if (Array.isArray(dayData)) {
        return sum + dayData.reduce((daySum, slot: any) => daySum + (slot.duration || 0), 0);
      }
      return sum + (dayData || 0);
    }, 0);
  }

  /**
   * Calculate project hours summary for reports
   */
  static calculateProjectHoursSummary(projects: Project[]): {
    totalEstimatedHours: number;
    totalCurrentProjects: number;
    totalFutureCommitments: number;
  } {
    const today = new Date();

    const currentProjects = projects.filter(project => {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      return start <= today && end >= today;
    });

    const futureCommitments = projects
      .filter(project => new Date(project.startDate) > today)
      .reduce((sum, project) => sum + project.estimatedHours, 0);

    const totalEstimatedHours = projects.reduce((sum, project) => sum + project.estimatedHours, 0);

    return {
      totalEstimatedHours,
      totalCurrentProjects: currentProjects.length,
      totalFutureCommitments: futureCommitments
    };
  }

  /**
   * Calculate average hours per day for reports
   */
  static calculateAverageHoursPerDay(
    projects: Project[],
    period: 'week' | 'month' | '6months',
    includedDays: Record<string, boolean>
  ): {
    timeline: Array<{ date: string; totalHours: number; projectCount: number }>;
    totalAverageHours: number;
    validDays: number;
  } {
    const today = new Date();
    const periodStart = new Date(today);

    // Calculate period start date
    switch (period) {
      case 'week':
        periodStart.setDate(today.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(today.getMonth() - 1);
        break;
      case '6months':
        periodStart.setMonth(today.getMonth() - 6);
        break;
    }

    // Generate date range
    const dates: Date[] = [];
    for (let d = new Date(periodStart); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // Calculate valid days in period
    const validDays = dates.filter(date => {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()] as keyof typeof includedDays;
      return includedDays[dayName];
    }).length;

    // Calculate daily totals
    const timeline = dates.map(date => {
      const dayProjects = projects.filter(project => {
        const start = new Date(project.startDate);
        const end = new Date(project.endDate);
        return start <= date && end >= date;
      });

      const totalHours = dayProjects.reduce((sum, project) => sum + project.estimatedHours, 0);
      const projectCount = dayProjects.length;

      return {
        date: date.toISOString().split('T')[0],
        totalHours: projectCount > 0 ? totalHours / projectCount : 0, // Average per project
        projectCount
      };
    });

    const totalAverageHours = timeline.reduce((sum, day) => sum + day.totalHours, 0);

    return {
      timeline,
      totalAverageHours,
      validDays
    };
  }
}
