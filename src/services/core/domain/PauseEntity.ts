/**
 * Pause Domain Entity (EXPERIMENTAL)
 * 
 * Contains pure business rules about project pauses - the fundamental "laws of physics"
 * for pause behavior. This is set up as a foundation for experimentation with
 * pauses as either milestone types or separate entities.
 * 
 * ✅ Pure functions only - no side effects, no external dependencies
 * ✅ Testable without mocks
 * ✅ Universal business rules
 */

import { Milestone, Project } from '@/types/core';

export interface Pause {
  id: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  description?: string;
}

export interface PauseImpactAnalysis {
  affectedMilestones: string[];
  recurringMilestonesAffected: string[];
  timelineShiftDays: number;
  pauseDurationDays: number;
}

export interface PauseValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PauseEntity {
  /**
   * Domain Rule: Pause end date must be after start date
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return endDate > startDate;
  }

  /**
   * Domain Rule: Pause must be within project timeframe
   */
  static isWithinProject(pause: Pause, project: Project): boolean {
    if (project.continuous) {
      // For continuous projects, pause must start after project start
      return pause.startDate >= project.startDate;
    }
    
    // For time-limited projects, pause must be within project bounds
    return pause.startDate >= project.startDate && pause.endDate <= project.endDate;
  }

  /**
   * Domain Rule: Calculate pause duration in days
   */
  static calculateDuration(pause: Pause): number {
    const diffTime = pause.endDate.getTime() - pause.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Domain Rule: Check if a milestone falls within a pause period
   */
  static doesPauseAffectMilestone(pause: Pause, milestone: Milestone): boolean {
    return milestone.dueDate >= pause.startDate && milestone.dueDate <= pause.endDate;
  }

  /**
   * Domain Rule: Check if a pause overlaps with another pause
   */
  static doesPauseOverlap(pause1: Pause, pause2: Pause): boolean {
    return !(pause1.endDate < pause2.startDate || pause2.endDate < pause1.startDate);
  }

  /**
   * Domain Rule: Validate pause constraints
   */
  static validatePause(
    pause: Pause,
    project: Project,
    existingPauses: Pause[] = []
  ): PauseValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate date range
    if (!this.validateDateRange(pause.startDate, pause.endDate)) {
      errors.push('Pause end date must be after start date');
    }

    // Validate project bounds
    if (!this.isWithinProject(pause, project)) {
      errors.push('Pause must be within project timeframe');
    }

    // Check for overlaps with existing pauses
    const overlappingPauses = existingPauses.filter(existingPause => 
      existingPause.id !== pause.id && this.doesPauseOverlap(pause, existingPause)
    );

    if (overlappingPauses.length > 0) {
      errors.push(`Pause overlaps with ${overlappingPauses.length} existing pause(s)`);
    }

    // Duration warnings
    const durationDays = this.calculateDuration(pause);
    if (durationDays > 30) {
      warnings.push('Pause duration is longer than 30 days');
    }

    if (durationDays < 1) {
      warnings.push('Pause duration is less than 1 day');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Domain Rule: Analyze pause impact on milestones
   */
  static analyzePauseImpact(
    pause: Pause,
    milestones: Milestone[]
  ): PauseImpactAnalysis {
    const affectedMilestones: string[] = [];
    const recurringMilestonesAffected: string[] = [];

    milestones.forEach(milestone => {
      if (this.doesPauseAffectMilestone(pause, milestone)) {
        affectedMilestones.push(milestone.id);
        
        // Check if it's a recurring milestone (by name pattern)
        if (milestone.name && /\s\d+$/.test(milestone.name)) {
          recurringMilestonesAffected.push(milestone.id);
        }
      }
    });

    const pauseDurationDays = this.calculateDuration(pause);
    
    return {
      affectedMilestones,
      recurringMilestonesAffected,
      timelineShiftDays: pauseDurationDays, // Simple assumption: shift equals pause duration
      pauseDurationDays
    };
  }

  /**
   * Domain Rule: Check if pause is in the past (requires current date from caller)
   */
  static isPauseInPast(pause: Pause, currentDate: Date): boolean {
    return pause.endDate < currentDate;
  }

  /**
   * Domain Rule: Check if pause is currently active (requires current date from caller)
   */
  static isPauseActive(pause: Pause, currentDate: Date): boolean {
    return currentDate >= pause.startDate && currentDate <= pause.endDate;
  }

  /**
   * Domain Rule: Check if pause is in the future (requires current date from caller)
   */
  static isPauseFuture(pause: Pause, currentDate: Date): boolean {
    return pause.startDate > currentDate;
  }

  /**
   * Domain Rule: Format pause duration display
   */
  static formatDuration(pause: Pause): string {
    const days = this.calculateDuration(pause);
    
    if (days === 1) {
      return '1 day';
    }
    
    if (days < 7) {
      return `${days} days`;
    }
    
    const weeks = Math.round(days / 7);
    if (weeks === 1) {
      return '1 week';
    }
    
    if (weeks < 5) {
      return `${weeks} weeks`;
    }
    
    const months = Math.round(days / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }

  /**
   * Domain Rule: Generate pause status description
   */
  static getStatusDescription(pause: Pause, currentDate: Date): string {
    if (this.isPauseInPast(pause, currentDate)) {
      return 'Completed';
    }
    
    if (this.isPauseActive(pause, currentDate)) {
      return 'Active';
    }
    
    if (this.isPauseFuture(pause, currentDate)) {
      return 'Scheduled';
    }
    
    return 'Unknown';
  }
}
