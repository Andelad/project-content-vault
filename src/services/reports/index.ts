// Reports services
export {
  calculateWeeklyCapacity,
  getCurrentProjects,
  calculateFutureCommitments,
  calculateValidDays,
  getAveragePeriodDateRange,
  getRelevantEventsForPeriod,
  calculateEventDurationHours,
  groupEventsByDate,
  calculateAverageDailyHours,
  calculateAverageDayData,
  calculateProjectLoadDistribution,
  getProductivityMetrics
} from './reportCalculationService';
export { calculateDailyTotals as calculateReportDailyTotals } from './reportCalculationService';