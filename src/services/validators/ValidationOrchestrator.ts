/**
 * Validation Orchestrator
 * 
 * Central orchestrator for all validation processes in the system.
 * Coordinates individual validators, handles validation workflows,
 * and provides comprehensive validation results and remediation strategies.
 * 
 * This orchestrator brings together:
 * - Individual entity validators (Project, Milestone, etc.)
 * - Cross-entity validation patterns
 * - System-wide integrity checks
 * - Performance-optimized validation workflows
 * 
 * @module ValidationOrchestrator
 */

import type { 
  Project, 
  Milestone, 
  CalendarEvent, 
  WorkHour, 
  Settings, 
  Group, 
  Row 
} from '@/types/core';

import { 
  ProjectValidator,
  type ProjectValidationContext,
  type DetailedProjectValidationResult as ProjectValidationResult
} from './ProjectValidator';

import { 
  MilestoneValidator,
  type ValidationContext as MilestoneValidationContext,
  type DetailedValidationResult as MilestoneValidationResult
} from './MilestoneValidator';

import {
  CrossEntityValidator,
  type SystemValidationContext,
  type CrossEntityValidationResult
} from './CrossEntityValidator';

import { validateEventForSplit } from './eventValidations';

// =====================================================================================
// VALIDATION ORCHESTRATOR INTERFACES
// =====================================================================================

export interface ValidationWorkflowOptions {
  // Performance options
  skipCrossEntityValidation?: boolean;
  skipIndividualValidation?: boolean;
  batchSize?: number;
  
  // Scope options
  validateProjects?: boolean;
  validateMilestones?: boolean;
  validateEvents?: boolean;
  validateWorkHours?: boolean;
  validateSettings?: boolean;
  
  // Output options
  includeWarnings?: boolean;
  includeSuggestions?: boolean;
  includePerformanceMetrics?: boolean;
  
  // Validation depth
  depth?: 'quick' | 'standard' | 'comprehensive';
  
  // Context filtering
  projectIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ComprehensiveValidationResult {
  // Overall status
  systemStatus: {
    isHealthy: boolean;
    overallScore: number; // 0-100
    severity: 'healthy' | 'warnings' | 'errors' | 'critical';
    timestamp: Date;
  };
  
  // Individual validation results
  individual: {
    projects: ProjectValidationResult[];
    milestones: MilestoneValidationResult[];
    events: Array<{ entityId: string; isValid: boolean; errors: string[]; warnings?: string[] }>;
    workHours: Array<{ entityId: string; isValid: boolean; errors: string[]; warnings?: string[] }>;
    settings: { isValid: boolean; errors: string[]; warnings?: string[] };
  };
  
  // Cross-entity validation
  crossEntity: CrossEntityValidationResult;
  
  // Consolidated issues
  consolidated: {
    criticalIssues: ValidationIssue[];
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    suggestions: ValidationSuggestion[];
  };
  
  // Remediation strategies
  remediation: {
    immediate: RemediationAction[];
    shortTerm: RemediationAction[];
    longTerm: RemediationAction[];
  };
  
  // Performance metrics
  performance?: {
    totalValidationTime: number;
    individualValidationTime: number;
    crossEntityValidationTime: number;
    entitiesValidated: number;
    validationRate: number; // entities per second
  };
  
  // Context information
  context: {
    validationOptions: ValidationWorkflowOptions;
    dataSnapshot: {
      projectCount: number;
      milestoneCount: number;
      eventCount: number;
      workHourCount: number;
    };
    validationScope: string[];
  };
}

export interface ValidationIssue {
  id: string;
  type: 'critical' | 'error' | 'warning';
  category: 'data_integrity' | 'business_rules' | 'system_consistency' | 'performance';
  message: string;
  affectedEntities: Array<{
    type: 'project' | 'milestone' | 'event' | 'work_hour' | 'settings';
    id: string;
    name?: string;
  }>;
  impact: 'low' | 'medium' | 'high' | 'critical';
  autoFixable: boolean;
  detectedAt: Date;
  context?: Record<string, any>;
}

export interface ValidationSuggestion {
  id: string;
  category: 'optimization' | 'best_practice' | 'user_experience' | 'data_quality';
  title: string;
  description: string;
  implementationEffort: 'low' | 'medium' | 'high';
  expectedBenefit: 'low' | 'medium' | 'high';
  affectedEntities: Array<{
    type: 'project' | 'milestone' | 'event' | 'work_hour' | 'settings';
    id: string;
    name?: string;
  }>;
  actionSteps: string[];
}

export interface RemediationAction {
  id: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: 'data_fix' | 'configuration' | 'user_action' | 'system_update';
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
  autoExecutable: boolean;
  dependencies: string[];
  affectedSystems: string[];
  successCriteria: string[];
  rollbackPlan?: string;
}

// =====================================================================================
// VALIDATION ORCHESTRATOR CLASS
// =====================================================================================

export class ValidationOrchestrator {
  
  // -------------------------------------------------------------------------------------
  // COMPREHENSIVE VALIDATION WORKFLOW
  // -------------------------------------------------------------------------------------

  /**
   * Execute comprehensive validation across entire system
   * This is the main entry point for full system validation
   */
  static async validateSystem(
    systemData: SystemValidationContext,
    options: ValidationWorkflowOptions = {}
  ): Promise<ComprehensiveValidationResult> {
    const startTime = performance.now();
    
    // Set defaults
    const validationOptions: ValidationWorkflowOptions = {
      depth: 'standard',
      validateProjects: true,
      validateMilestones: true,
      validateEvents: true,
      validateWorkHours: true,
      validateSettings: true,
      includeWarnings: true,
      includeSuggestions: true,
      includePerformanceMetrics: true,
      batchSize: 50,
      ...options
    };

    // Filter data by scope if specified
    const scopedData = this.applyScopeFilters(systemData, validationOptions);
    
    // Initialize results structure
    const result: ComprehensiveValidationResult = {
      systemStatus: {
        isHealthy: true,
        overallScore: 100,
        severity: 'healthy',
        timestamp: new Date()
      },
      individual: {
        projects: [],
        milestones: [],
        events: [],
        workHours: [],
        settings: { isValid: true, errors: [] }
      },
      crossEntity: {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        criticalIssues: [],
        affectedEntities: { projects: [], milestones: [], events: [], workHours: [] },
        context: {
          totalIssues: 0,
          severity: 'low',
          systemHealth: {
            overallStatus: 'healthy',
            dataIntegrity: 100,
            businessRuleCompliance: 100
          }
        }
      },
      consolidated: {
        criticalIssues: [],
        errors: [],
        warnings: [],
        suggestions: []
      },
      remediation: {
        immediate: [],
        shortTerm: [],
        longTerm: []
      },
      context: {
        validationOptions,
        dataSnapshot: {
          projectCount: scopedData.projects.length,
          milestoneCount: scopedData.milestones.length,
          eventCount: scopedData.events.length,
          workHourCount: scopedData.workHours.length
        },
        validationScope: []
      }
    };

    let individualValidationTime = 0;
    let crossEntityValidationTime = 0;

    try {
      // 1. Individual Entity Validation (parallel when possible)
      if (!validationOptions.skipIndividualValidation) {
        const individualStartTime = performance.now();
        
        await this.executeIndividualValidation(
          scopedData, 
          validationOptions, 
          result
        );
        
        individualValidationTime = performance.now() - individualStartTime;
      }

      // 2. Cross-Entity Validation
      if (!validationOptions.skipCrossEntityValidation) {
        const crossEntityStartTime = performance.now();
        
        result.crossEntity = await CrossEntityValidator.validateSystemIntegrity(scopedData);
        
        crossEntityValidationTime = performance.now() - crossEntityStartTime;
      }

      // 3. Consolidate Results
      this.consolidateValidationResults(result, scopedData);

      // 4. Generate Remediation Strategies
      this.generateRemediationStrategies(result);

      // 5. Calculate System Health Metrics
      this.calculateSystemHealthMetrics(result);

    } catch (error) {
      console.error('Validation orchestration error:', error);
      
      result.systemStatus.isHealthy = false;
      result.systemStatus.severity = 'critical';
      result.consolidated.criticalIssues.push({
        id: `validation-error-${Date.now()}`,
        type: 'critical',
        category: 'system_consistency',
        message: `Validation process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedEntities: [],
        impact: 'critical',
        autoFixable: false,
        detectedAt: new Date(),
        context: { error: String(error) }
      });
    }

    // Add performance metrics if requested
    if (validationOptions.includePerformanceMetrics) {
      const totalTime = performance.now() - startTime;
      const entitiesValidated = scopedData.projects.length + scopedData.milestones.length + 
                               scopedData.events.length + scopedData.workHours.length;

      result.performance = {
        totalValidationTime: Math.round(totalTime),
        individualValidationTime: Math.round(individualValidationTime),
        crossEntityValidationTime: Math.round(crossEntityValidationTime),
        entitiesValidated,
        validationRate: Math.round((entitiesValidated / (totalTime / 1000)) * 100) / 100
      };
    }

    return result;
  }

  // -------------------------------------------------------------------------------------
  // TARGETED VALIDATION WORKFLOWS
  // -------------------------------------------------------------------------------------

  /**
   * Validate specific entities with focused validation
   */
  static async validateEntities(
    entities: {
      projects?: Project[];
      milestones?: Milestone[];
      events?: CalendarEvent[];
      workHours?: WorkHour[];
    },
    systemContext: SystemValidationContext,
    options: ValidationWorkflowOptions = {}
  ): Promise<Partial<ComprehensiveValidationResult>> {
    const validationOptions = { ...options, depth: options.depth || 'quick' };
    
    // TODO: Implement focused entity validation
    // This would validate only the specified entities plus any cross-entity relationships
    
    return {
      systemStatus: {
        isHealthy: true,
        overallScore: 100,
        severity: 'healthy',
        timestamp: new Date()
      },
      individual: {
        projects: [],
        milestones: [],
        events: [],
        workHours: [],
        settings: { isValid: true, errors: [] }
      }
    } as Partial<ComprehensiveValidationResult>;
  }

  /**
   * Quick validation for real-time validation during user interactions
   */
  static async validateQuick(
    entity: Project | Milestone | CalendarEvent | WorkHour,
    systemContext: Partial<SystemValidationContext>
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings?: string[];
    suggestions?: string[];
  }> {
    // TODO: Implement quick validation for real-time feedback
    // This would perform basic validation without expensive cross-entity checks
    
    return {
      isValid: true,
      errors: []
    };
  }

  // -------------------------------------------------------------------------------------
  // VALIDATION EXECUTION METHODS
  // -------------------------------------------------------------------------------------

  /**
   * Execute individual entity validation for all entity types
   */
  private static async executeIndividualValidation(
    data: SystemValidationContext,
    options: ValidationWorkflowOptions,
    result: ComprehensiveValidationResult
  ): Promise<void> {
    const batchSize = options.batchSize || 50;

    // Validate Projects
    if (options.validateProjects && data.projects.length > 0) {
      for (let i = 0; i < data.projects.length; i += batchSize) {
        const batch = data.projects.slice(i, i + batchSize);
        
        for (const project of batch) {
          const context: ProjectValidationContext = {
            existingProjects: data.projects,
            projectMilestones: data.milestones.filter(m => m.projectId === project.id)
          };

          // Use validateProjectCreation as the primary validation method
          const validation = await ProjectValidator.validateProjectCreation(
            {
              name: project.name,
              startDate: project.startDate,
              endDate: project.endDate!,
              estimatedHours: project.estimatedHours
            },
            context
          );
          
          result.individual.projects.push({
            ...validation,
            // Add missing properties for compatibility
            projectId: project.id,
            projectName: project.name
          } as any);
        }
      }
    }

    // Validate Milestones
    if (options.validateMilestones && data.milestones.length > 0) {
      for (let i = 0; i < data.milestones.length; i += batchSize) {
        const batch = data.milestones.slice(i, i + batchSize);
        
        for (const milestone of batch) {
          const context: MilestoneValidationContext = {
            project: data.projects.find(p => p.id === milestone.projectId)!,
            existingMilestones: data.milestones
          };

          // Use validateMilestoneCreation as the primary validation method
          const validation = await MilestoneValidator.validateMilestoneCreation(
            {
              name: milestone.name,
              dueDate: milestone.dueDate,
              timeAllocation: milestone.timeAllocation,
              projectId: milestone.projectId
            },
            context
          );
          
          result.individual.milestones.push(validation);
        }
      }
    }

    // Validate Events (simplified validation)
    if (options.validateEvents && data.events.length > 0) {
      for (const event of data.events) {
        // Basic event validation using available function
        const isValid = validateEventForSplit(event, {
          start: event.startTime,
          end: event.endTime
        });
        
        result.individual.events.push({
          entityId: event.id,
          isValid,
          errors: isValid ? [] : ['Event validation failed'],
          warnings: []
        });
      }
    }

    // Validate Work Hours (basic validation without external validator)
    if (options.validateWorkHours && data.workHours.length > 0) {
      for (const workHour of data.workHours) {
        // Basic work hour validation
        const errors: string[] = [];
        
        if (workHour.endTime <= workHour.startTime) {
          errors.push('End time must be after start time');
        }
        
        const duration = workHour.endTime.getTime() - workHour.startTime.getTime();
        if (duration < 15 * 60 * 1000) { // Less than 15 minutes
          errors.push('Work hour duration must be at least 15 minutes');
        }
        
        result.individual.workHours.push({
          entityId: workHour.id,
          isValid: errors.length === 0,
          errors,
          warnings: []
        });
      }
    }

    // Validate Settings (basic validation without external validator)
    if (options.validateSettings) {
      const errors: string[] = [];
      
      // Basic settings validation based on actual Settings interface
      const totalWorkHours = Object.values(data.settings.weeklyWorkHours).reduce(
        (total, daySlots) => total + daySlots.length,
        0
      );
      
      if (totalWorkHours === 0) {
        errors.push('At least one work slot must be defined in weekly work hours');
      }
      
      // Validate work slots
      Object.entries(data.settings.weeklyWorkHours).forEach(([day, slots]) => {
        slots.forEach((slot, index) => {
          if (!slot.startTime || !slot.endTime) {
            errors.push(`${day} slot ${index + 1}: Start and end times are required`);
          } else if (slot.startTime >= slot.endTime) {
            errors.push(`${day} slot ${index + 1}: End time must be after start time`);
          }
        });
      });
      
      result.individual.settings = {
        isValid: errors.length === 0,
        errors,
        warnings: []
      };
    }
  }

  /**
   * Apply scope filters to system data based on validation options
   */
  private static applyScopeFilters(
    data: SystemValidationContext,
    options: ValidationWorkflowOptions
  ): SystemValidationContext {
    let filteredData = { ...data };

    // Filter by project IDs if specified
    if (options.projectIds && options.projectIds.length > 0) {
      filteredData.projects = data.projects.filter(p => 
        options.projectIds!.includes(p.id)
      );
      
      filteredData.milestones = data.milestones.filter(m =>
        options.projectIds!.includes(m.projectId)
      );
      
      // TODO: Filter events and work hours by associated projects
    }

    // Filter by date range if specified
    if (options.dateRange) {
      const { start, end } = options.dateRange;
      
      filteredData.projects = filteredData.projects.filter(p =>
        p.startDate <= end && (!p.endDate || p.endDate >= start)
      );
      
      filteredData.milestones = filteredData.milestones.filter(m =>
        m.dueDate >= start && m.dueDate <= end
      );
      
      filteredData.events = filteredData.events.filter(e =>
        e.startTime <= end && e.endTime >= start
      );
      
      filteredData.workHours = filteredData.workHours.filter(w =>
        w.startTime <= end && w.endTime >= start
      );
    }

    return filteredData;
  }

  /**
   * Consolidate individual and cross-entity validation results
   */
  private static consolidateValidationResults(
    result: ComprehensiveValidationResult,
    systemData: SystemValidationContext
  ): void {
    // Collect all issues from individual validations
    const allIssues: ValidationIssue[] = [];
    let issueId = 1;

    // Process project validation results
    for (let i = 0; i < result.individual.projects.length; i++) {
      const projectValidation = result.individual.projects[i];
      const project = systemData.projects[i]; // Get corresponding project data
      
      if (!projectValidation.isValid) {
        projectValidation.errors.forEach(error => {
          allIssues.push({
            id: `project-error-${issueId++}`,
            type: 'error',
            category: 'business_rules',
            message: error,
            affectedEntities: [{
              type: 'project',
              id: project?.id || 'unknown',
              name: project?.name || 'Unknown Project'
            }],
            impact: 'medium',
            autoFixable: false,
            detectedAt: new Date()
          });
        });
      }

      projectValidation.warnings?.forEach(warning => {
        allIssues.push({
          id: `project-warning-${issueId++}`,
          type: 'warning',
          category: 'data_integrity',
          message: warning,
          affectedEntities: [{
            type: 'project',
            id: project?.id || 'unknown',
            name: project?.name || 'Unknown Project'
          }],
          impact: 'low',
          autoFixable: false,
          detectedAt: new Date()
        });
      });
    }

    // Process cross-entity validation results
    result.crossEntity.criticalIssues.forEach(issue => {
      allIssues.push({
        id: `cross-critical-${issueId++}`,
        type: 'critical',
        category: 'system_consistency',
        message: issue,
        affectedEntities: [], // TODO: Extract from cross-entity context
        impact: 'critical',
        autoFixable: false,
        detectedAt: new Date()
      });
    });

    // Categorize consolidated issues
    result.consolidated = {
      criticalIssues: allIssues.filter(issue => issue.type === 'critical'),
      errors: allIssues.filter(issue => issue.type === 'error'),
      warnings: allIssues.filter(issue => issue.type === 'warning'),
      suggestions: [] // TODO: Convert suggestions to structured format
    };
  }

  /**
   * Generate remediation strategies based on validation results
   */
  private static generateRemediationStrategies(result: ComprehensiveValidationResult): void {
    // TODO: Implement intelligent remediation strategy generation
    // This would analyze validation issues and create actionable remediation plans
    
    result.remediation = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };
  }

  /**
   * Calculate overall system health metrics
   */
  private static calculateSystemHealthMetrics(result: ComprehensiveValidationResult): void {
    const totalIssues = result.consolidated.criticalIssues.length + 
                       result.consolidated.errors.length + 
                       result.consolidated.warnings.length;

    const totalEntities = result.context.dataSnapshot.projectCount + 
                         result.context.dataSnapshot.milestoneCount + 
                         result.context.dataSnapshot.eventCount + 
                         result.context.dataSnapshot.workHourCount;

    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for issues
    healthScore -= result.consolidated.criticalIssues.length * 25; // Critical issues: -25 points each
    healthScore -= result.consolidated.errors.length * 10;         // Errors: -10 points each  
    healthScore -= result.consolidated.warnings.length * 2;        // Warnings: -2 points each

    healthScore = Math.max(0, healthScore);

    // Determine severity
    let severity: ComprehensiveValidationResult['systemStatus']['severity'] = 'healthy';
    if (result.consolidated.criticalIssues.length > 0) {
      severity = 'critical';
    } else if (result.consolidated.errors.length > 0) {
      severity = 'errors';
    } else if (result.consolidated.warnings.length > 5) {
      severity = 'warnings';
    }

    result.systemStatus = {
      isHealthy: result.consolidated.criticalIssues.length === 0 && 
                result.consolidated.errors.length === 0,
      overallScore: healthScore,
      severity,
      timestamp: new Date()
    };
  }
}
