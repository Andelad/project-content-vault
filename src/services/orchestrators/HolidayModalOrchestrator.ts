/**
 * Holiday Modal Orchestrator
 * Handles complex holiday creation and editing workflows including overlap detection and auto-fixing
 * 
 * Following AI Development Rules - orchestrators handle multi-step processes with database operations
 * Extracted from HolidayModal.tsx following Phase 3D Holiday Modal Orchestration
 */

import { Holiday } from '@/types/core';
import { addDaysToDate } from '../calculations/general/dateCalculations';

export interface HolidayFormData {
  title: string;
  startDate: Date;
  endDate: Date;
  notes: string;
}

export interface HolidayValidationResult {
  isValid: boolean;
  hasOverlaps: boolean;
  overlappingHolidays?: Holiday[];
  adjustedDates?: {
    startDate: Date;
    endDate: Date;
    adjustmentMessage: string;
  };
  error?: string;
}

export interface HolidayModalResult {
  success: boolean;
  needsUserConfirmation?: boolean;
  adjustedDates?: {
    startDate: Date;
    endDate: Date;
    message: string;
  };
  error?: string;
}

export class HolidayModalOrchestrator {
  private existingHolidays: Holiday[];
  private currentHolidayId?: string;

  constructor(existingHolidays: Holiday[], currentHolidayId?: string) {
    this.existingHolidays = existingHolidays;
    this.currentHolidayId = currentHolidayId;
  }

  /**
   * Validates holiday form data and checks for overlaps
   */
  validateHolidayData(formData: HolidayFormData): HolidayValidationResult {
    // Basic validation
    if (!formData.title.trim()) {
      return {
        isValid: false,
        hasOverlaps: false,
        error: 'Holiday title is required'
      };
    }

    if (!formData.startDate || !formData.endDate) {
      return {
        isValid: false,
        hasOverlaps: false,
        error: 'Start date and end date are required'
      };
    }

    // Date validation
    if (formData.startDate > formData.endDate) {
      return {
        isValid: false,
        hasOverlaps: false,
        error: 'Start date cannot be after end date'
      };
    }

    // Check for overlaps
    const overlappingHolidays = this.findOverlappingHolidays(formData.startDate, formData.endDate);
    
    if (overlappingHolidays.length > 0) {
      const adjustedDates = this.calculateAdjustedDates(
        formData.startDate, 
        formData.endDate, 
        overlappingHolidays
      );

      return {
        isValid: false,
        hasOverlaps: true,
        overlappingHolidays,
        adjustedDates
      };
    }

    return {
      isValid: true,
      hasOverlaps: false
    };
  }

  /**
   * Orchestrates holiday creation workflow
   */
  async createHolidayWorkflow(
    formData: HolidayFormData,
    addHoliday: (holidayData: Omit<Holiday, 'id'>) => void
  ): Promise<HolidayModalResult> {
    try {
      const validation = this.validateHolidayData(formData);
      
      if (!validation.isValid) {
        if (validation.hasOverlaps && validation.adjustedDates) {
          // Return adjusted dates for user confirmation
          return {
            success: false,
            needsUserConfirmation: true,
            adjustedDates: {
              startDate: validation.adjustedDates.startDate,
              endDate: validation.adjustedDates.endDate,
              message: this.generateOverlapMessage(validation.overlappingHolidays!, validation.adjustedDates.adjustmentMessage)
            }
          };
        }
        
        return {
          success: false,
          error: validation.error
        };
      }

      // Create holiday data
      const holidayData = {
        title: formData.title.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes.trim()
      };

      addHoliday(holidayData);

      return { success: true };
    } catch (error) {
      console.error('HolidayModalOrchestrator: Failed to create holiday:', error);
      return {
        success: false,
        error: 'Failed to create holiday. Please try again.'
      };
    }
  }

  /**
   * Orchestrates holiday update workflow
   */
  async updateHolidayWorkflow(
    formData: HolidayFormData,
    holidayId: string,
    updateHoliday: (id: string, holidayData: Partial<Holiday>) => void
  ): Promise<HolidayModalResult> {
    try {
      const validation = this.validateHolidayData(formData);
      
      if (!validation.isValid) {
        if (validation.hasOverlaps && validation.adjustedDates) {
          // Return adjusted dates for user confirmation
          return {
            success: false,
            needsUserConfirmation: true,
            adjustedDates: {
              startDate: validation.adjustedDates.startDate,
              endDate: validation.adjustedDates.endDate,
              message: this.generateOverlapMessage(validation.overlappingHolidays!, validation.adjustedDates.adjustmentMessage)
            }
          };
        }
        
        return {
          success: false,
          error: validation.error
        };
      }

      // Update holiday data
      const holidayData = {
        title: formData.title.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes.trim()
      };

      updateHoliday(holidayId, holidayData);

      return { success: true };
    } catch (error) {
      console.error('HolidayModalOrchestrator: Failed to update holiday:', error);
      return {
        success: false,
        error: 'Failed to update holiday. Please try again.'
      };
    }
  }

  /**
   * Finds holidays that overlap with the given date range
   */
  private findOverlappingHolidays(startDate: Date, endDate: Date): Holiday[] {
    return this.existingHolidays.filter(holiday => {
      // Skip the current holiday if editing
      if (this.currentHolidayId && holiday.id === this.currentHolidayId) {
        return false;
      }
      
      // Check if dates overlap
      return startDate <= holiday.endDate && holiday.startDate <= endDate;
    });
  }

  /**
   * Calculates adjusted dates to resolve overlaps
   */
  private calculateAdjustedDates(
    startDate: Date, 
    endDate: Date, 
    overlappingHolidays: Holiday[]
  ): { startDate: Date; endDate: Date; adjustmentMessage: string } {
    let adjustedStartDate = new Date(startDate);
    let adjustedEndDate = new Date(endDate);
    let adjustmentMessage = '';
    
    // Check if start date overlaps - move it after the conflicting holiday
    const startOverlap = overlappingHolidays.find(h => 
      startDate <= h.endDate && startDate >= h.startDate
    );
    
    if (startOverlap) {
      adjustedStartDate = new Date(startOverlap.endDate);
      adjustedStartDate = addDaysToDate(adjustedStartDate, 1);
      adjustmentMessage = `Start date moved to ${adjustedStartDate.toDateString()} (after "${startOverlap.title}")`;
    }
    
    // Check if end date overlaps - move it before the conflicting holiday
    const endOverlap = overlappingHolidays.find(h => 
      endDate >= h.startDate && endDate <= h.endDate
    );
    
    if (endOverlap && !startOverlap) { // Only adjust end if we didn't already adjust start
      adjustedEndDate = new Date(endOverlap.startDate);
      adjustedEndDate = addDaysToDate(adjustedEndDate, -1);
      adjustmentMessage = `End date moved to ${adjustedEndDate.toDateString()} (before "${endOverlap.title}")`;
    }

    return {
      startDate: adjustedStartDate,
      endDate: adjustedEndDate,
      adjustmentMessage
    };
  }

  /**
   * Generates user-friendly overlap message
   */
  private generateOverlapMessage(overlappingHolidays: Holiday[], adjustmentMessage: string): string {
    const conflictList = overlappingHolidays
      .map(h => `• "${h.title}" (${h.startDate.toDateString()} - ${h.endDate.toDateString()})`)
      .join('\n');
    
    return `❌ Holiday overlap detected!\n\nConflicting holidays:\n${conflictList}\n\n✅ Auto-fixed: ${adjustmentMessage}\n\nYou can now save or make further adjustments.`;
  }

  /**
   * Updates the orchestrator context with new holidays
   */
  updateContext(existingHolidays: Holiday[], currentHolidayId?: string): void {
    this.existingHolidays = existingHolidays;
    this.currentHolidayId = currentHolidayId;
  }
}

// Export factory function for creating orchestrator instances
export const createHolidayModalOrchestrator = (
  existingHolidays: Holiday[], 
  currentHolidayId?: string
): HolidayModalOrchestrator => {
  return new HolidayModalOrchestrator(existingHolidays, currentHolidayId);
};
