/**
 * Milestone Calculation Service
 * 
 * Handles calculations related to milestones, including budget validation,
 * date difference calculations, and recurring pattern detection.
 */

export interface Milestone {
  id: string;
  name: string;
  dueDate: string | Date;
  timeAllocation: number;
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  baseName: string;
}

export interface MilestoneValidationResult {
  isValid: boolean;
  totalAllocation: number;
  exceedsBy?: number;
  message?: string;
}

export class MilestoneCalculationService {
  /**
   * Calculate total milestone allocation
   */
  static calculateTotalAllocation(milestones: Milestone[]): number {
    return milestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
  }

  /**
   * Validate milestone allocation against project budget
   */
  static validateMilestoneAllocation(
    milestones: Milestone[],
    projectEstimatedHours: number,
    excludeMilestoneId?: string
  ): MilestoneValidationResult {
    const relevantMilestones = excludeMilestoneId 
      ? milestones.filter(m => m.id !== excludeMilestoneId)
      : milestones;
    
    const totalAllocation = Math.ceil(this.calculateTotalAllocation(relevantMilestones));
    const isValid = totalAllocation <= projectEstimatedHours;
    
    if (!isValid) {
      const exceedsBy = totalAllocation - projectEstimatedHours;
      return {
        isValid: false,
        totalAllocation,
        exceedsBy,
        message: `Total milestone allocation (${totalAllocation}h) exceeds project budget (${projectEstimatedHours}h) by ${exceedsBy}h.`
      };
    }
    
    return {
      isValid: true,
      totalAllocation
    };
  }

  /**
   * Validate adding a new milestone to existing allocation
   */
  static validateNewMilestoneAllocation(
    existingMilestones: Milestone[],
    newMilestoneAllocation: number,
    projectEstimatedHours: number
  ): MilestoneValidationResult {
    const currentTotal = this.calculateTotalAllocation(existingMilestones);
    const newTotal = Math.ceil(currentTotal + newMilestoneAllocation);
    const isValid = newTotal <= projectEstimatedHours;
    
    if (!isValid) {
      const exceedsBy = newTotal - projectEstimatedHours;
      return {
        isValid: false,
        totalAllocation: newTotal,
        exceedsBy,
        message: `Total milestone allocation (${newTotal}h) would exceed project budget (${projectEstimatedHours}h) by ${exceedsBy}h.`
      };
    }
    
    return {
      isValid: true,
      totalAllocation: newTotal
    };
  }

  /**
   * Validate updating an existing milestone allocation
   */
  static validateMilestoneUpdate(
    milestones: Milestone[],
    milestoneId: string,
    newAllocation: number,
    projectEstimatedHours: number
  ): MilestoneValidationResult {
    const updatedMilestones = milestones.map(m => 
      m.id === milestoneId ? { ...m, timeAllocation: newAllocation } : m
    );
    
    return this.validateMilestoneAllocation(updatedMilestones, projectEstimatedHours);
  }

  /**
   * Calculate days difference between two dates
   */
  static calculateDaysDifference(firstDate: Date | string, secondDate: Date | string): number {
    const first = new Date(firstDate);
    const second = new Date(secondDate);
    return Math.round((second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Detect recurring pattern from milestones
   */
  static detectRecurringPattern(milestones: Milestone[]): RecurringPattern | null {
    // Filter milestones that match recurring pattern (ends with space and number)
    const recurringPattern = milestones.filter(m => 
      m.name && /\s\d+$/.test(m.name)
    );
    
    if (recurringPattern.length < 1) {
      return null;
    }
    
    // Sort by due date
    const sortedMilestones = recurringPattern.sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    
    let type: 'daily' | 'weekly' | 'monthly' = 'weekly';
    let interval = 1;
    
    if (sortedMilestones.length > 1) {
      // Calculate interval between milestones
      const daysDifference = this.calculateDaysDifference(
        sortedMilestones[0].dueDate,
        sortedMilestones[1].dueDate
      );
      
      if (daysDifference === 1) {
        type = 'daily';
        interval = 1;
      } else if (daysDifference === 7) {
        type = 'weekly';
        interval = 1;
      } else if (daysDifference >= 28 && daysDifference <= 31) {
        type = 'monthly';
        interval = 1;
      } else if (daysDifference % 7 === 0) {
        type = 'weekly';
        interval = daysDifference / 7;
      }
    }
    
    // Extract base name (remove the number at the end)
    const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
    
    return {
      type,
      interval,
      baseName
    };
  }

  /**
   * Calculate dynamic input width based on content length
   */
  static calculateInputWidth(content: string, baseWidth: number = 80, charWidth: number = 8): number {
    return Math.max(content.length * charWidth + 40, baseWidth);
  }

  /**
   * Sort milestones by due date
   */
  static sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
    return [...milestones].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }

  /**
   * Format milestone date for display
   */
  static formatMilestoneDate(date: Date | string): string {
    const milestoneDate = new Date(date);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${months[milestoneDate.getMonth()]} ${milestoneDate.getDate()}`;
  }

  /**
   * Check if milestone date matches a specific date
   */
  static isMilestoneDueOnDate(milestone: Milestone, targetDate: Date): boolean {
    const milestoneDate = new Date(milestone.dueDate);
    return milestoneDate.toDateString() === targetDate.toDateString();
  }

  /**
   * Generate temporary milestone ID
   */
  static generateTempId(): string {
    return `temp-${Date.now()}`;
  }

  /**
   * Calculate ordinal number suffix (1st, 2nd, 3rd, etc.)
   */
  static getOrdinalNumber(num: number): string {
    const suffix = ['th', 'st', 'nd', 'rd'];
    const value = num % 100;
    return num + (suffix[(value - 20) % 10] || suffix[value] || suffix[0]);
  }
}
