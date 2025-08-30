// Calendar integration services (flat structure)
export * from './calendarIntegration';

// Calendar calculations (subfolder structure - >1 calculation service)
export * from './calculations/calendarInsightService';
export * from './calculations/calendarPositioningService';
export { 
  expandHolidayDates, 
  isHolidayDate, 
  getHolidaysInRange, 
  formatDateRange,
  type Holiday as CalendarHoliday,
  type DateRangeFormatOptions 
} from './calculations/dateRangeService';
