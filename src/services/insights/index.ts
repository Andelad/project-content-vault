// Insights services
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
} from './insightsCalculationService';
export { calculateDailyTotals as calculateReportDailyTotals } from './insightsCalculationService';