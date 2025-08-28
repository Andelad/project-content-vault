/**
 * Central Services Index
 * Feature-based service organization with barrel exports
 * 
 * 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
 * 
 * ❌ DON'T add calculations to:
 *    - Components (render logic only)
 *    - Hooks (state management only) 
 *    - Utils (use these services instead)
 *
 * ✅ Feature-organized services:
 */

// Feature-based service exports
export * from './events';
export * from './milestones';
export * from './performance';
export * from './projects';
export * from './reports';
export * from './settings';
export * from './timeline';
export * from './work-hours';

// Project overlap service
export * from './projectOverlapService';

// Explicit exports for missing services
export { CalendarIntegrationService, type ImportResult } from './calendar/calendarIntegration';
export { TimeAllocationService } from './core/TimeAllocationService';
export { HeightCalculationService } from './core/HeightCalculationService';
export { WorkHourCalculationService } from './core/WorkHourCalculationService';
export { expandHolidayDates } from './calendar/dateRangeService';
export { calculateDailyTotals } from './calendar/calendarInsightService';

