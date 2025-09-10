/**
 * Validation System Usage Examples
 * 
 * Demonstrates how to use the comprehensive validation system
 * including individual validators, cross-entity validation, and
 * the orchestrated validation workflows.
 * 
 * @module ValidationExamples
 */

import type { 
  Project, 
  Milestone, 
  CalendarEvent, 
  WorkHour, 
  Settings 
} from '@/types/core';

import { 
  ValidationOrchestrator,
  type ValidationWorkflowOptions,
  type ComprehensiveValidationResult
} from './ValidationOrchestrator';

import { 
  CrossEntityValidator,
  type CrossEntityValidationResult,
  type SystemValidationContext
} from './CrossEntityValidator';

import { ProjectValidator } from './ProjectValidator';
import { MilestoneValidator } from './MilestoneValidator';

// =====================================================================================
// COMPREHENSIVE SYSTEM VALIDATION EXAMPLE
// =====================================================================================

/**
 * Example: Complete system health check
 * Run comprehensive validation across entire system
 */
export async function exampleSystemHealthCheck(
  projects: Project[],
  milestones: Milestone[],
  events: CalendarEvent[],
  workHours: WorkHour[],
  settings: Settings,
  groups: any[],
  rows: any[]
): Promise<ComprehensiveValidationResult> {
  
  const systemContext: SystemValidationContext = {
    projects,
    milestones,
    events,
    workHours,
    groups,
    rows,
    settings
  };

  const validationOptions: ValidationWorkflowOptions = {
    depth: 'comprehensive',
    includeWarnings: true,
    includeSuggestions: true,
    includePerformanceMetrics: true
  };

  const result = await ValidationOrchestrator.validateSystem(
    systemContext,
    validationOptions
  );

  // Log results for analysis
  console.log('=== SYSTEM HEALTH CHECK RESULTS ===');
  console.log(`Overall Health: ${result.systemStatus.isHealthy ? '✅ Healthy' : '❌ Issues Detected'}`);
  console.log(`Health Score: ${result.systemStatus.overallScore}/100`);
  console.log(`Severity: ${result.systemStatus.severity}`);
  
  if (result.consolidated.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    result.consolidated.criticalIssues.forEach(issue => {
      console.log(`  - ${issue.message}`);
    });
  }

  if (result.consolidated.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    result.consolidated.errors.forEach(error => {
      console.log(`  - ${error.message}`);
    });
  }

  if (result.consolidated.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    result.consolidated.warnings.forEach(warning => {
      console.log(`  - ${warning.message}`);
    });
  }

  if (result.performance) {
    console.log('\n📊 PERFORMANCE METRICS:');
    console.log(`  Total validation time: ${result.performance.totalValidationTime}ms`);
    console.log(`  Entities validated: ${result.performance.entitiesValidated}`);
    console.log(`  Validation rate: ${result.performance.validationRate} entities/sec`);
  }

  return result;
}

// =====================================================================================
// TARGETED VALIDATION EXAMPLES
// =====================================================================================

/**
 * Example: Validate specific projects and their relationships
 */
export async function exampleProjectFocusedValidation(
  projectIds: string[],
  allSystemData: SystemValidationContext
): Promise<Partial<ComprehensiveValidationResult>> {
  
  const validationOptions: ValidationWorkflowOptions = {
    depth: 'standard',
    projectIds,
    validateProjects: true,
    validateMilestones: true,
    skipCrossEntityValidation: false
  };

  return await ValidationOrchestrator.validateEntities(
    {
      projects: allSystemData.projects.filter(p => projectIds.includes(p.id)),
      milestones: allSystemData.milestones.filter(m => projectIds.includes(m.projectId))
    },
    allSystemData,
    validationOptions
  );
}

/**
 * Example: Quick validation for real-time feedback
 */
export async function exampleQuickValidation(
  project: Project,
  systemContext: Partial<SystemValidationContext>
): Promise<{ isValid: boolean; errors: string[] }> {
  
  return await ValidationOrchestrator.validateQuick(project, systemContext);
}

// =====================================================================================
// CROSS-ENTITY VALIDATION EXAMPLES
// =====================================================================================

/**
 * Example: Focus on project-milestone relationship validation
 */
export async function exampleProjectMilestoneValidation(
  projects: Project[],
  milestones: Milestone[]
): Promise<CrossEntityValidationResult['affectedEntities']> {
  
  const validation = await CrossEntityValidator.validateAllProjectMilestoneRelationships(
    projects,
    milestones
  );

  console.log('=== PROJECT-MILESTONE VALIDATION ===');
  console.log(`Projects analyzed: ${projects.length}`);
  console.log(`Affected projects: ${validation.affectedProjects.length}`);
  
  if (validation.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (validation.suggestions.length > 0) {
    console.log('\n💡 SUGGESTIONS:');
    validation.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
  }

  return {
    projects: validation.affectedProjects,
    milestones: [],
    events: [],
    workHours: []
  };
}

/**
 * Example: Event-WorkHour consistency check
 */
export function exampleEventWorkHourValidation(
  events: CalendarEvent[],
  workHours: WorkHour[]
) {
  const validation = CrossEntityValidator.validateEventWorkHourConsistency(
    events,
    workHours
  );

  console.log('=== EVENT-WORKHOUR CONSISTENCY ===');
  console.log(`Total inconsistencies: ${validation.totalInconsistencies}`);
  console.log(`Affected time ranges: ${validation.affectedTimeRanges.length}`);
  
  validation.inconsistencies.forEach((inconsistency, index) => {
    console.log(`\n${index + 1}. ${inconsistency.type.toUpperCase()}`);
    console.log(`   Severity: ${inconsistency.severity}`);
    console.log(`   Description: ${inconsistency.description}`);
    console.log(`   Recommended Action: ${inconsistency.recommendedAction}`);
  });

  return validation;
}

// =====================================================================================
// INDIVIDUAL VALIDATOR EXAMPLES
// =====================================================================================

/**
 * Example: Individual project validation
 */
export async function exampleIndividualProjectValidation(
  projectData: {
    name: string;
    startDate: Date;
    endDate: Date;
    estimatedHours: number;
  },
  context: {
    existingProjects: Project[];
    projectMilestones: Milestone[];
  }
) {
  const validation = await ProjectValidator.validateProjectCreation(
    projectData,
    context
  );

  console.log('=== INDIVIDUAL PROJECT VALIDATION ===');
  console.log(`Project: ${projectData.name}`);
  console.log(`Valid: ${validation.isValid ? '✅' : '❌'}`);
  
  if (!validation.isValid) {
    console.log('\n❌ ERRORS:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  if (validation.warnings && validation.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (validation.suggestions && validation.suggestions.length > 0) {
    console.log('\n💡 SUGGESTIONS:');
    validation.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
  }

  if (validation.context?.budgetAnalysis) {
    console.log('\n📊 BUDGET ANALYSIS:');
    const budget = validation.context.budgetAnalysis;
    console.log(`  Current utilization: ${budget.currentUtilization}%`);
    console.log(`  Milestones: ${budget.milestoneCount}`);
    console.log(`  Avg milestone allocation: ${budget.avgMilestoneAllocation}h`);
  }

  return validation;
}

/**
 * Example: Individual milestone validation
 */
export async function exampleIndividualMilestoneValidation(
  milestoneData: {
    name: string;
    dueDate: Date;
    timeAllocation: number;
    projectId: string;
  },
  context: {
    project: Project;
    existingMilestones: Milestone[];
  }
) {
  const validation = await MilestoneValidator.validateMilestoneCreation(
    milestoneData,
    context
  );

  console.log('=== INDIVIDUAL MILESTONE VALIDATION ===');
  console.log(`Milestone: ${milestoneData.name}`);
  console.log(`Project: ${context.project.name}`);
  console.log(`Valid: ${validation.isValid ? '✅' : '❌'}`);
  
  if (!validation.isValid) {
    console.log('\n❌ ERRORS:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  if (validation.context?.budgetImpact) {
    console.log('\n💰 BUDGET IMPACT:');
    const budget = validation.context.budgetImpact;
    console.log(`  Current utilization: ${budget.currentUtilization}%`);
    console.log(`  New utilization: ${budget.newUtilization}%`);
    console.log(`  Remaining budget: ${budget.remainingBudget}h`);
  }

  return validation;
}

// =====================================================================================
// PERFORMANCE TESTING EXAMPLES
// =====================================================================================

/**
 * Example: Performance testing with large datasets
 */
export async function examplePerformanceValidation(
  systemData: SystemValidationContext
): Promise<{
  standardValidation: number;
  quickValidation: number;
  crossEntityOnly: number;
}> {
  
  const performanceResults = {
    standardValidation: 0,
    quickValidation: 0,
    crossEntityOnly: 0
  };

  // Test 1: Standard comprehensive validation
  const start1 = performance.now();
  await ValidationOrchestrator.validateSystem(systemData, {
    depth: 'standard',
    includePerformanceMetrics: true
  });
  performanceResults.standardValidation = performance.now() - start1;

  // Test 2: Quick validation (minimal checks)
  const start2 = performance.now();
  await ValidationOrchestrator.validateSystem(systemData, {
    depth: 'quick',
    skipCrossEntityValidation: true,
    includeWarnings: false,
    includeSuggestions: false
  });
  performanceResults.quickValidation = performance.now() - start2;

  // Test 3: Cross-entity validation only
  const start3 = performance.now();
  await ValidationOrchestrator.validateSystem(systemData, {
    skipIndividualValidation: true,
    validateProjects: false,
    validateMilestones: false,
    validateEvents: false,
    validateWorkHours: false
  });
  performanceResults.crossEntityOnly = performance.now() - start3;

  console.log('=== PERFORMANCE COMPARISON ===');
  console.log(`Standard validation: ${performanceResults.standardValidation.toFixed(2)}ms`);
  console.log(`Quick validation: ${performanceResults.quickValidation.toFixed(2)}ms`);
  console.log(`Cross-entity only: ${performanceResults.crossEntityOnly.toFixed(2)}ms`);

  return performanceResults;
}

// =====================================================================================
// ERROR HANDLING EXAMPLES
// =====================================================================================

/**
 * Example: Robust validation with error handling
 */
export async function exampleRobustValidation(
  systemData: SystemValidationContext
): Promise<ComprehensiveValidationResult | null> {
  
  try {
    const result = await ValidationOrchestrator.validateSystem(systemData, {
      depth: 'comprehensive',
      includeWarnings: true,
      includeSuggestions: true
    });

    // Process successful validation
    if (result.systemStatus.isHealthy) {
      console.log('✅ System validation passed');
      return result;
    } else {
      console.log('⚠️ System validation completed with issues');
      
      // Handle different types of issues
      if (result.consolidated.criticalIssues.length > 0) {
        console.log('🚨 Critical issues require immediate attention');
        // Trigger alerts or notifications
      }

      if (result.consolidated.errors.length > 0) {
        console.log('❌ Errors need to be resolved');
        // Log errors for developer review
      }

      return result;
    }

  } catch (error) {
    console.error('Validation system error:', error);
    
    // Fallback: Try basic validation
    try {
      console.log('Attempting fallback validation...');
      return await ValidationOrchestrator.validateSystem(systemData, {
        depth: 'quick',
        skipCrossEntityValidation: true
      });
    } catch (fallbackError) {
      console.error('Fallback validation also failed:', fallbackError);
      return null;
    }
  }
}
