/**
 * @deprecated Legacy ProjectCalculationService
 * 
 * This service has been migrated to the unified architecture.
 * All functionality is now available through:
 * - UnifiedProjectService (unified/UnifiedProjectService.ts)
 * 
 * This wrapper maintains backward compatibility but should be replaced
 * with direct calls to the new service.
 * 
 * Migration completed: Added calculation methods to existing UnifiedProjectService
 * Breaking changes: None - all methods maintain the same signatures
 */

import * as UnifiedProjectService from '../../unified/UnifiedProjectService.js';
import { UnifiedProjectEntity } from '../../unified/UnifiedProjectService.js';
import type { Project, Milestone } from '../../../types/core.js';

console.warn('⚠️  ProjectCalculationService is deprecated. Use UnifiedProjectService instead.');

// Legacy interfaces for backward compatibility
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
   * @deprecated Use UnifiedProjectEntity.calculateProjectMetrics()
   */
  static calculateProjectMetrics(project: Project, settings: any, holidays: Date[] = []): ProjectTimeMetrics {
    console.warn('⚠️  ProjectCalculationService.calculateProjectMetrics() is deprecated. Use UnifiedProjectEntity.calculateProjectMetrics() instead.');
    
    const unifiedMetrics = UnifiedProjectEntity.calculateProjectMetrics(project, project.milestones || [], settings);
    
    // Convert to legacy format
    const totalDays = UnifiedProjectService.calculateProjectDuration(new Date(project.startDate), new Date(project.endDate));
    const businessDays = Math.max(1, Math.ceil(totalDays * 5/7)); // Estimate business days
    const dailyHours = unifiedMetrics.dailyCapacity;
    const weeklyHours = unifiedMetrics.weeklyCapacity;
    const utilizationRate = project.estimatedHours / (businessDays * dailyHours);
    
    return {
      totalDays,
      businessDays,
      dailyHours,
      weeklyHours,
      isOverAllocated: utilizationRate > 1,
      utilizationRate,
      endDateProjection: unifiedMetrics.estimatedEndDate || new Date(project.endDate)
    };
  }

  /**
   * @deprecated Use UnifiedProjectEntity.calculateMilestoneMetrics()
   */
  static calculateMilestoneMetrics(milestones: Milestone[], projectBudget: number) {
    console.warn('⚠️  ProjectCalculationService.calculateMilestoneMetrics() is deprecated. Use UnifiedProjectEntity.calculateMilestoneMetrics() instead.');
    
    const totalAllocated = milestones.reduce((sum, milestone) => sum + milestone.timeAllocation, 0);
    const remainingBudget = projectBudget - totalAllocated;
    const budgetUtilization = totalAllocated / projectBudget;
    
    const milestoneBreakdown = milestones.map(milestone => ({
      id: milestone.id,
      name: milestone.name,
      allocation: milestone.timeAllocation,
      percentage: (milestone.timeAllocation / projectBudget) * 100,
      dueDate: milestone.dueDate
    }));

    return {
      totalAllocated,
      remainingBudget,
      budgetUtilization,
      milestoneBreakdown,
      isOverAllocated: budgetUtilization > 1,
      allocationEfficiency: budgetUtilization
    };
  }

  /**
   * @deprecated Use UnifiedProjectEntity.calculateDailyWorkCapacity()
   */
  static calculateDailyWorkCapacity(settings: any): number {
    console.warn('⚠️  ProjectCalculationService.calculateDailyWorkCapacity() is deprecated. Use UnifiedProjectEntity.calculateDailyWorkCapacity() instead.');
    return settings?.workHours?.hoursPerDay || 8;
  }

  /**
   * @deprecated Use UnifiedProjectEntity.calculateWeeklyWorkCapacity()
   */
  static calculateWeeklyWorkCapacity(settings: any): number {
    console.warn('⚠️  ProjectCalculationService.calculateWeeklyWorkCapacity() is deprecated. Use UnifiedProjectEntity.calculateWeeklyWorkCapacity() instead.');
    const dailyCapacity = this.calculateDailyWorkCapacity(settings);
    return dailyCapacity * 5; // 5 business days
  }

  /**
   * @deprecated Use UnifiedProjectEntity.calculateProjectEndDate()
   */
  static calculateProjectEndDate(startDate: Date, estimatedHours: number, settings: any, holidays: Date[] = []): Date {
    console.warn('⚠️  ProjectCalculationService.calculateProjectEndDate() is deprecated. Use UnifiedProjectEntity.calculateProjectEndDate() instead.');
    
    const dailyCapacity = this.calculateDailyWorkCapacity(settings);
    const daysRequired = Math.ceil(estimatedHours / dailyCapacity);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysRequired);
    
    return endDate;
  }

  /**
   * @deprecated Use UnifiedProjectEntity.calculateProjectOverlaps()
   */
  static calculateProjectOverlaps(projects: Project[]) {
    console.warn('⚠️  ProjectCalculationService.calculateProjectOverlaps() is deprecated. Use UnifiedProjectEntity.calculateProjectOverlaps() instead.');
    return UnifiedProjectEntity.calculateProjectOverlaps(projects);
  }

  /**
   * @deprecated Use UnifiedProjectEntity.validateMilestoneTimeline()
   */
  static validateMilestoneTimeline(project: Project, milestones: Milestone[]) {
    console.warn('⚠️  ProjectCalculationService.validateMilestoneTimeline() is deprecated. Use UnifiedProjectEntity.validateMilestoneTimeline() instead.');
    return UnifiedProjectEntity.validateMilestoneTimeline(project, milestones);
  }

  // Additional legacy methods for backward compatibility
  
  /**
   * @deprecated Internal helper method - use UnifiedProjectService methods instead
   */
  static calculateTimelineGaps(projects: Project[]): Array<{startDate: Date, endDate: Date, duration: number}> {
    console.warn('⚠️  ProjectCalculationService.calculateTimelineGaps() is deprecated.');
    const gaps: Array<{startDate: Date, endDate: Date, duration: number}> = [];
    
    const sortedProjects = projects.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    for (let i = 0; i < sortedProjects.length - 1; i++) {
      const current = sortedProjects[i];
      const next = sortedProjects[i + 1];
      
      const currentEnd = new Date(current.endDate);
      const nextStart = new Date(next.startDate);
      
      if (nextStart > currentEnd) {
        const gapDuration = Math.ceil((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));
        gaps.push({
          startDate: currentEnd,
          endDate: nextStart,
          duration: gapDuration
        });
      }
    }
    
    return gaps;
  }

  /**
   * @deprecated Internal helper method - use UnifiedProjectService methods instead
   */
  static calculateResourceAllocation(projects: Project[], totalCapacity: number): {
    allocation: number;
    isOverAllocated: boolean;
    utilizationRate: number;
  } {
    console.warn('⚠️  ProjectCalculationService.calculateResourceAllocation() is deprecated.');
    
    const totalDemand = projects.reduce((sum, project) => sum + project.estimatedHours, 0);
    const allocation = totalDemand / totalCapacity;
    
    return {
      allocation,
      isOverAllocated: allocation > 1,
      utilizationRate: Math.min(1, allocation)
    };
  }

  /**
   * @deprecated Internal helper method - use UnifiedProjectService methods instead
   */
  static projectWorkloadAnalysis(project: Project, settings: any): {
    weeklyBreakdown: Array<{week: number, hours: number, capacity: number}>;
    overloadedWeeks: number[];
    averageUtilization: number;
  } {
    console.warn('⚠️  ProjectCalculationService.projectWorkloadAnalysis() is deprecated.');
    
    const weeklyCapacity = this.calculateWeeklyWorkCapacity(settings);
    const totalWeeks = Math.ceil(UnifiedProjectService.calculateProjectDuration(new Date(project.startDate), new Date(project.endDate)) / 7);
    const hoursPerWeek = project.estimatedHours / totalWeeks;
    
    const weeklyBreakdown = Array.from({length: totalWeeks}, (_, i) => ({
      week: i + 1,
      hours: hoursPerWeek,
      capacity: weeklyCapacity
    }));
    
    const overloadedWeeks = weeklyBreakdown
      .filter(week => week.hours > week.capacity)
      .map(week => week.week);
    
    const averageUtilization = hoursPerWeek / weeklyCapacity;
    
    return {
      weeklyBreakdown,
      overloadedWeeks,
      averageUtilization
    };
  }
}
