/**
 * Recurring milestone calculation service
 * Extracted from MilestoneManager for reusability and testing
 */

export interface RecurringMilestoneConfig {
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  timeAllocation: number;
}

export interface RecurringMilestoneCalculationParams {
  config: RecurringMilestoneConfig;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
}

/**
 * Calculate how many milestones a recurring configuration would generate
 */
export function calculateRecurringMilestoneCount(params: RecurringMilestoneCalculationParams): number {
  const { config, projectStartDate, projectEndDate, projectContinuous = false } = params;
  
  let count = 0;
  let currentDate = new Date(projectStartDate);
  currentDate.setDate(currentDate.getDate() + 1); // Start day after project start
  
  const endDate = projectContinuous ? 
    new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000) : // 1 year for continuous
    new Date(projectEndDate);
  endDate.setDate(endDate.getDate() - 1); // End day before project end

  while (currentDate <= endDate && count < 100) { // Safety limit of 100
    count++;
    
    switch (config.recurringType) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + config.recurringInterval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * config.recurringInterval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
        break;
    }
  }
  
  return count;
}

/**
 * Calculate total time allocation for recurring milestones
 */
export function calculateRecurringTotalAllocation(params: RecurringMilestoneCalculationParams): number {
  const count = calculateRecurringMilestoneCount(params);
  return count * params.config.timeAllocation;
}

/**
 * Generate milestone dates for a recurring configuration
 */
export function generateRecurringMilestoneDates(params: RecurringMilestoneCalculationParams): Date[] {
  const { config, projectStartDate, projectEndDate, projectContinuous = false } = params;
  
  const dates: Date[] = [];
  let currentDate = new Date(projectStartDate);
  currentDate.setDate(currentDate.getDate() + 1);
  
  const endDate = projectContinuous ? 
    new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000) :
    new Date(projectEndDate);
  endDate.setDate(endDate.getDate() - 1);

  let count = 0;
  while (currentDate <= endDate && count < 100) {
    dates.push(new Date(currentDate));
    count++;
    
    switch (config.recurringType) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + config.recurringInterval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * config.recurringInterval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
        break;
    }
  }
  
  return dates;
}

/**
 * Detect recurring pattern from existing milestone names and dates
 */
export function detectRecurringPattern(milestones: Array<{ name: string; dueDate: Date }>): {
  baseName: string;
  recurringType: 'daily' | 'weekly' | 'monthly';
  interval: number;
} | null {
  const recurringPattern = milestones.filter(m => 
    m.name && /\s\d+$/.test(m.name) // Ends with space and number
  );
  
  if (recurringPattern.length < 2) return null;
  
  const sortedMilestones = recurringPattern.sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  // Calculate interval between first two milestones
  const firstDate = new Date(sortedMilestones[0].dueDate);
  const secondDate = new Date(sortedMilestones[1].dueDate);
  const daysDifference = Math.round((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let recurringType: 'daily' | 'weekly' | 'monthly' = 'weekly';
  let interval = 1;
  
  if (daysDifference === 1) {
    recurringType = 'daily';
    interval = 1;
  } else if (daysDifference === 7) {
    recurringType = 'weekly';
    interval = 1;
  } else if (daysDifference >= 28 && daysDifference <= 31) {
    recurringType = 'monthly';
    interval = 1;
  } else if (daysDifference % 7 === 0) {
    recurringType = 'weekly';
    interval = daysDifference / 7;
  }
  
  // Extract base name (remove the number at the end)
  const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
  
  return { baseName, recurringType, interval };
}
