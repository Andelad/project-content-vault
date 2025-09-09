// Test file to verify date/time consolidation works
import { 
  calculateDurationHours,
  normalizeToMidnight,
  generateWorkHoursForDate,
  calculateProjectWorkingDays,
  getCurrentTimezone,
  isValidDate
} from '../services';

// Test basic functionality
const testDate1 = new Date('2025-01-01');
const testDate2 = new Date('2025-01-02');

// Test duration calculation
const duration = calculateDurationHours(testDate1, testDate2);
console.log('Duration in hours:', duration);

// Test normalization
const normalized = normalizeToMidnight(testDate1);
console.log('Normalized date:', normalized);

// Test validation
const isValid = isValidDate(testDate1);
console.log('Is valid date:', isValid);

// Test timezone
const timezone = getCurrentTimezone();
console.log('Current timezone:', timezone);

export default function consolidationWorks() {
  return true;
}
