/**
 * Work Hour Domain Entity
 * 
 * Thin wrapper that provides domain-specific interfaces.
 * All calculations delegate to core calculations (single source of truth).
 * 
 * ✅ Domain-specific interface
 * ✅ Delegates to core calculations  
 * ✅ Data validation only
 * ❌ NO business logic duplication
 */

import { WorkHour as WorkHourType } from '@/types';
import { 
  calculateDurationHours,
  calculateDurationMinutes,
  formatDuration,
  formatDurationFromMinutes
} from '../calculations/dateCalculations';

export class WorkHourEntity {
  /**
   * Calculate work hour duration
   * DELEGATES to single source of truth
   */
  static calculateDuration(startTime: Date, endTime: Date): number {
    return calculateDurationHours(startTime, endTime);
  }

  /**
   * Calculate duration in minutes
   * DELEGATES to single source of truth
   */
  static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    return calculateDurationMinutes(startTime, endTime);
  }

  /**
   * SINGLE SOURCE OF TRUTH: Format duration for display
   * Consolidates all duplicate formatDuration functions
   */
  static formatDuration(hours: number): string {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (wholeHours === 0) {
      return `${minutes}m`;
    }
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    
    return `${wholeHours}h ${minutes}m`;
  }

  /**
   * SINGLE SOURCE OF TRUTH: Format duration preview from times
   * Consolidates formatDurationPreview functions
   */
  static formatDurationPreview(startTime: Date, endTime: Date): string {
    const durationMinutes = this.calculateDurationMinutes(startTime, endTime);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}m`;
    }
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${minutes}m`;
  }

  /**
   * SINGLE SOURCE OF TRUTH: Validate work hour times
   */
  static validateWorkHour(startTime: Date, endTime: Date): { valid: boolean; error?: string } {
    if (startTime >= endTime) {
      return { valid: false, error: 'End time must be after start time' };
    }

    const duration = this.calculateDuration(startTime, endTime);
    if (duration > 24) {
      return { valid: false, error: 'Work hours cannot exceed 24 hours' };
    }

    return { valid: true };
  }

  /**
   * SINGLE SOURCE OF TRUTH: Create work hour with validation
   */
  static createWorkHour(
    startTime: Date,
    endTime: Date,
    description: string,
    projectId?: string
  ): { workHour?: WorkHourType; error?: string } {
    const validation = this.validateWorkHour(startTime, endTime);
    if (!validation.valid) {
      return { error: validation.error };
    }

    const workHour = {
      id: crypto.randomUUID(),
      title: description,
      startTime,
      endTime,
      duration: this.calculateDuration(startTime, endTime),
      description,
      date: new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate()),
      ...(projectId && { projectId })
    };

    return { workHour };
  }
}
