/**
 * Cross-Entity Validator
 * 
 * Handles complex validation rules that span multiple domains and entities.
 * Coordinates validation between Projects, Milestones, Events, WorkHours, and Settings
 * to ensure data consistency and business rule compliance across the entire system.
 * 
 * Key Responsibilities:
 * - Project-Milestone relationship validation
 * - Event-WorkHour consistency validation  
 * - Cross-domain timeline validation
 * - System-wide data integrity validation
 * - Business rule enforcement across entities
 * 
 * @module CrossEntityValidator
 */

import type { Project, Milestone, CalendarEvent, WorkHour, Settings, Group, Row } from '@/types/core';
import { ProjectValidator, type ProjectValidationContext } from './ProjectValidator';
import { MilestoneValidator, type ValidationContext } from './MilestoneValidator';
import { 
  UnifiedProjectEntity, 
  UnifiedMilestoneEntity,
  type ProjectBudgetAnalysis 
} from '../unified';
import { 
  calculateDurationDays,
  calculateTimeOverlapMinutes 
} from '../calculations/dateCalculations';

// =====================================================================================
// CROSS-ENTITY VALIDATION INTERFACES
// =====================================================================================

export interface SystemValidationContext {
  projects: Project[];
  milestones: Milestone[];
  events: CalendarEvent[];
  workHours: WorkHour[];
  groups: Group[];
  rows: Row[];
  settings: Settings;
}

export interface CrossEntityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  criticalIssues: string[];
  affectedEntities: {
    projects: string[];
    milestones: string[];
    events: string[];
    workHours: string[];
  };
  context: {
    totalIssues: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    systemHealth: {
      overallStatus: 'healthy' | 'warning' | 'critical';
      dataIntegrity: number; // 0-100 percentage
      businessRuleCompliance: number; // 0-100 percentage
    };
  };
}

export interface ProjectMilestoneRelationshipValidation {
  projectId: string;
  issues: {
    budgetMismatch?: {
      projectBudget: number;
      milestoneAllocation: number;
      overageAmount: number;
    };
    dateConflicts?: {
      milestonesOutOfRange: Milestone[];
      projectDateRange: { start: Date; end: Date };
    };
    orphanedMilestones?: Milestone[];
    missingMilestones?: {
      severity: 'warning' | 'critical';
      reason: string;
    };
  };
  recommendations: string[];
}

export interface EventWorkHourConsistencyValidation {
  inconsistencies: Array<{
    type: 'duration_mismatch' | 'overlap_conflict' | 'missing_work_hour' | 'missing_event';
    entity1: CalendarEvent | WorkHour;
    entity2?: CalendarEvent | WorkHour;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendedAction: string;
  }>;
  totalInconsistencies: number;
  affectedTimeRanges: Array<{
    start: Date;
    end: Date;
    conflictType: string;
  }>;
}

export interface TimelineConsistencyValidation {
  conflicts: Array<{
    type: 'project_overlap' | 'milestone_scheduling' | 'resource_overallocation';
    entities: Array<Project | Milestone | CalendarEvent>;
    timeRange: { start: Date; end: Date };
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: string;
    resolution: string[];
  }>;
  resourceAllocation: {
    overallocatedPeriods: Array<{
      date: Date;
      plannedHours: number;
      availableHours: number;
      overageHours: number;
    }>;
    underutilizedPeriods: Array<{
      date: Date;
      plannedHours: number;
      availableHours: number;
      unutilizedHours: number;
    }>;
  };
}

// =====================================================================================
// CROSS-ENTITY VALIDATOR CLASS
// =====================================================================================

export class CrossEntityValidator {

  // -------------------------------------------------------------------------------------
  // COMPREHENSIVE SYSTEM VALIDATION
  // -------------------------------------------------------------------------------------

  /**
   * Perform comprehensive validation across all system entities
   * This is the main entry point for system-wide validation
   */
  static async validateSystemIntegrity(
    context: SystemValidationContext
  ): Promise<CrossEntityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const criticalIssues: string[] = [];
    const affectedEntities = {
      projects: [] as string[],
      milestones: [] as string[],
      events: [] as string[],
      workHours: [] as string[]
    };

    // 1. Validate Project-Milestone relationships
    const projectMilestoneValidation = await this.validateAllProjectMilestoneRelationships(
      context.projects,
      context.milestones
    );
    errors.push(...projectMilestoneValidation.errors);
    warnings.push(...projectMilestoneValidation.warnings);
    suggestions.push(...projectMilestoneValidation.suggestions);
    
    // Collect affected entities
    projectMilestoneValidation.affectedProjects.forEach(projectId => {
      if (!affectedEntities.projects.includes(projectId)) {
        affectedEntities.projects.push(projectId);
      }
    });

    // 2. Validate Event-WorkHour consistency
    const eventWorkHourValidation = this.validateEventWorkHourConsistency(
      context.events,
      context.workHours
    );
    
    eventWorkHourValidation.inconsistencies.forEach(inconsistency => {
      const message = `${inconsistency.type}: ${inconsistency.description}`;
      
      if (inconsistency.severity === 'high') {
        criticalIssues.push(message);
      } else if (inconsistency.severity === 'medium') {
        warnings.push(message);
      }
      
      suggestions.push(inconsistency.recommendedAction);
    });

    // 3. Validate timeline consistency
    const timelineValidation = this.validateTimelineConsistency(
      context.projects,
      context.milestones,
      context.events,
      context.workHours,
      context.settings
    );
    
    timelineValidation.conflicts.forEach(conflict => {
      const message = `${conflict.type}: ${conflict.impact}`;
      
      if (conflict.severity === 'critical') {
        criticalIssues.push(message);
      } else if (conflict.severity === 'high') {
        errors.push(message);
      } else if (conflict.severity === 'medium') {
        warnings.push(message);
      }
      
      suggestions.push(...conflict.resolution);
    });

    // 4. Validate organizational structure
    const structureValidation = this.validateOrganizationalStructure(
      context.projects,
      context.groups,
      context.rows
    );
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    // Calculate overall health metrics
    const totalIssues = errors.length + warnings.length + criticalIssues.length;
    const severity = this.calculateSeverity(errors, warnings, criticalIssues);
    const systemHealth = this.calculateSystemHealth(context, totalIssues);

    return {
      isValid: errors.length === 0 && criticalIssues.length === 0,
      errors,
      warnings,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      criticalIssues,
      affectedEntities,
      context: {
        totalIssues,
        severity,
        systemHealth
      }
    };
  }

  // -------------------------------------------------------------------------------------
  // PROJECT-MILESTONE RELATIONSHIP VALIDATION
  // -------------------------------------------------------------------------------------

  /**
   * Validate relationships between all projects and their milestones
   */
  static async validateAllProjectMilestoneRelationships(
    projects: Project[],
    allMilestones: Milestone[]
  ): Promise<{
    errors: string[];
    warnings: string[];
    suggestions: string[];
    validations: ProjectMilestoneRelationshipValidation[];
    affectedProjects: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const validations: ProjectMilestoneRelationshipValidation[] = [];
    const affectedProjects: string[] = [];

    for (const project of projects) {
      const projectMilestones = allMilestones.filter(m => m.projectId === project.id);
      
      const validation = await this.validateProjectMilestoneRelationship(
        project,
        projectMilestones,
        allMilestones
      );

      validations.push(validation);

      // Collect issues
      if (validation.issues.budgetMismatch) {
        errors.push(`Project ${project.name}: Budget exceeded by ${validation.issues.budgetMismatch.overageAmount}h`);
        affectedProjects.push(project.id);
      }

      if (validation.issues.dateConflicts?.milestonesOutOfRange.length) {
        const count = validation.issues.dateConflicts.milestonesOutOfRange.length;
        warnings.push(`Project ${project.name}: ${count} milestones fall outside project dates`);
        affectedProjects.push(project.id);
      }

      if (validation.issues.orphanedMilestones?.length) {
        const count = validation.issues.orphanedMilestones.length;
        warnings.push(`Project ${project.name}: ${count} orphaned milestones found`);
        affectedProjects.push(project.id);
      }

      if (validation.issues.missingMilestones) {
        if (validation.issues.missingMilestones.severity === 'critical') {
          errors.push(`Project ${project.name}: ${validation.issues.missingMilestones.reason}`);
        } else {
          warnings.push(`Project ${project.name}: ${validation.issues.missingMilestones.reason}`);
        }
        affectedProjects.push(project.id);
      }

      suggestions.push(...validation.recommendations.map(rec => 
        `${project.name}: ${rec}`
      ));
    }

    return {
      errors,
      warnings,
      suggestions,
      validations,
      affectedProjects: [...new Set(affectedProjects)]
    };
  }

  /**
   * Validate relationship between a single project and its milestones
   */
  static async validateProjectMilestoneRelationship(
    project: Project,
    projectMilestones: Milestone[],
    allMilestones: Milestone[]
  ): Promise<ProjectMilestoneRelationshipValidation> {
    const issues: ProjectMilestoneRelationshipValidation['issues'] = {};
    const recommendations: string[] = [];

    // 1. Budget validation
    const budgetAnalysis = UnifiedProjectEntity.analyzeBudget(project, projectMilestones);
    if (budgetAnalysis.isOverBudget) {
      issues.budgetMismatch = {
        projectBudget: project.estimatedHours,
        milestoneAllocation: budgetAnalysis.totalAllocatedHours,
        overageAmount: budgetAnalysis.overageHours
      };
      recommendations.push('Reduce milestone allocations or increase project budget');
    }

    // 2. Date range validation  
    const milestonesOutOfRange = projectMilestones.filter(milestone =>
      milestone.dueDate < project.startDate || 
      (project.endDate && milestone.dueDate > project.endDate)
    );

    if (milestonesOutOfRange.length > 0) {
      issues.dateConflicts = {
        milestonesOutOfRange,
        projectDateRange: { start: project.startDate, end: project.endDate! }
      };
      recommendations.push('Adjust milestone dates to fit within project timeline');
    }

    // 3. Orphaned milestones check
    const orphanedMilestones = projectMilestones.filter(milestone =>
      milestone.projectId !== project.id // This shouldn't happen but let's check
    );

    if (orphanedMilestones.length > 0) {
      issues.orphanedMilestones = orphanedMilestones;
      recommendations.push('Fix milestone project assignments');
    }

    // 4. Missing milestones analysis
    const duration = calculateDurationDays(project.startDate, project.endDate || new Date());
    if (duration > 30 && projectMilestones.length === 0) {
      issues.missingMilestones = {
        severity: 'critical',
        reason: 'Long-duration project has no milestones for progress tracking'
      };
      recommendations.push('Add milestones to track project progress');
    } else if (duration > 14 && projectMilestones.length === 0) {
      issues.missingMilestones = {
        severity: 'warning',
        reason: 'Project has no milestones for progress tracking'
      };
      recommendations.push('Consider adding milestones to track project progress');
    }

    // 5. Milestone distribution analysis
    if (projectMilestones.length > 0 && duration > 0) {
      const density = projectMilestones.length / (duration / 7); // milestones per week
      
      if (density > 5) {
        recommendations.push('Consider consolidating milestones - very high density detected');
      } else if (density < 0.1) {
        recommendations.push('Consider adding more milestones for better progress tracking');
      }
    }

    return {
      projectId: project.id,
      issues,
      recommendations
    };
  }

  // -------------------------------------------------------------------------------------
  // EVENT-WORKHOUR CONSISTENCY VALIDATION
  // -------------------------------------------------------------------------------------

  /**
   * Validate consistency between calendar events and work hours
   */
  static validateEventWorkHourConsistency(
    events: CalendarEvent[],
    workHours: WorkHour[]
  ): EventWorkHourConsistencyValidation {
    const inconsistencies: EventWorkHourConsistencyValidation['inconsistencies'] = [];
    const affectedTimeRanges: EventWorkHourConsistencyValidation['affectedTimeRanges'] = [];

    // Check for events that should have corresponding work hours
    for (const event of events) {
      if (event.type === 'tracked' && event.completed) {
        // Find corresponding work hours
        const correspondingWorkHours = workHours.filter(wh =>
          Math.abs(wh.startTime.getTime() - event.startTime.getTime()) < 60000 && // Within 1 minute
          Math.abs(wh.endTime.getTime() - event.endTime.getTime()) < 60000
        );

        if (correspondingWorkHours.length === 0) {
          inconsistencies.push({
            type: 'missing_work_hour',
            entity1: event,
            severity: 'medium',
            description: `Completed tracked event "${event.title}" has no corresponding work hour`,
            recommendedAction: 'Create work hour entry for tracked time'
          });

          affectedTimeRanges.push({
            start: event.startTime,
            end: event.endTime,
            conflictType: 'missing_work_hour'
          });
        }
      }
    }

    // Check for work hours that overlap unexpectedly
    for (let i = 0; i < workHours.length; i++) {
      for (let j = i + 1; j < workHours.length; j++) {
        const wh1 = workHours[i];
        const wh2 = workHours[j];

        const overlapMinutes = calculateTimeOverlapMinutes(
          wh1.startTime, wh1.endTime,
          wh2.startTime, wh2.endTime
        );

        if (overlapMinutes > 0) {
          inconsistencies.push({
            type: 'overlap_conflict',
            entity1: wh1,
            entity2: wh2,
            severity: 'high',
            description: `Work hours overlap by ${overlapMinutes} minutes`,
            recommendedAction: 'Adjust work hour times to eliminate overlap'
          });

          affectedTimeRanges.push({
            start: new Date(Math.max(wh1.startTime.getTime(), wh2.startTime.getTime())),
            end: new Date(Math.min(wh1.endTime.getTime(), wh2.endTime.getTime())),
            conflictType: 'overlap_conflict'
          });
        }
      }
    }

    return {
      inconsistencies,
      totalInconsistencies: inconsistencies.length,
      affectedTimeRanges
    };
  }

  // -------------------------------------------------------------------------------------
  // TIMELINE CONSISTENCY VALIDATION
  // -------------------------------------------------------------------------------------

  /**
   * Validate overall timeline consistency across all entities
   */
  static validateTimelineConsistency(
    projects: Project[],
    milestones: Milestone[],
    events: CalendarEvent[],
    workHours: WorkHour[],
    settings: Settings
  ): TimelineConsistencyValidation {
    const conflicts: TimelineConsistencyValidation['conflicts'] = [];
    const resourceAllocation = {
      overallocatedPeriods: [] as any[],
      underutilizedPeriods: [] as any[]
    };

    // TODO: Implement detailed timeline consistency validation
    // This would include:
    // - Project overlap detection
    // - Resource overallocation analysis
    // - Milestone scheduling conflicts
    // - Work capacity vs planned work analysis

    return {
      conflicts,
      resourceAllocation
    };
  }

  // -------------------------------------------------------------------------------------
  // ORGANIZATIONAL STRUCTURE VALIDATION
  // -------------------------------------------------------------------------------------

  /**
   * Validate organizational structure integrity
   */
  static validateOrganizationalStructure(
    projects: Project[],
    groups: Group[],
    rows: Row[]
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned projects (projects without valid group/row)
    for (const project of projects) {
      const projectGroup = groups.find(g => g.id === project.groupId);
      if (!projectGroup) {
        errors.push(`Project "${project.name}" references non-existent group ID: ${project.groupId}`);
        continue;
      }

      const projectRow = rows.find(r => r.id === project.rowId && r.groupId === project.groupId);
      if (!projectRow) {
        errors.push(`Project "${project.name}" references non-existent row ID: ${project.rowId} in group: ${project.groupId}`);
      }
    }

    // Check for empty groups/rows
    for (const group of groups) {
      const groupProjects = projects.filter(p => p.groupId === group.id);
      if (groupProjects.length === 0) {
        warnings.push(`Group "${group.name}" has no projects`);
      }

      const groupRows = rows.filter(r => r.groupId === group.id);
      if (groupRows.length === 0) {
        warnings.push(`Group "${group.name}" has no rows`);
      }
    }

    return { errors, warnings };
  }

  // -------------------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------------------

  private static calculateSeverity(
    errors: string[], 
    warnings: string[], 
    criticalIssues: string[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (criticalIssues.length > 0) return 'critical';
    if (errors.length > 5) return 'high';
    if (errors.length > 0 || warnings.length > 10) return 'medium';
    return 'low';
  }

  private static calculateSystemHealth(
    context: SystemValidationContext,
    totalIssues: number
  ): {
    overallStatus: 'healthy' | 'warning' | 'critical';
    dataIntegrity: number;
    businessRuleCompliance: number;
  } {
    const totalEntities = context.projects.length + context.milestones.length + 
                         context.events.length + context.workHours.length;
    
    // Calculate data integrity percentage (inverse of issue ratio)
    const dataIntegrity = Math.max(0, Math.min(100, 100 - ((totalIssues / Math.max(1, totalEntities)) * 100)));
    
    // Business rule compliance (simplified calculation)
    const businessRuleCompliance = Math.max(0, Math.min(100, 100 - (totalIssues * 5)));
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (dataIntegrity < 50 || businessRuleCompliance < 50) {
      overallStatus = 'critical';
    } else if (dataIntegrity < 80 || businessRuleCompliance < 80) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      dataIntegrity: Math.round(dataIntegrity),
      businessRuleCompliance: Math.round(businessRuleCompliance)
    };
  }
}
