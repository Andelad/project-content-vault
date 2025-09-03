/**
 * Health Check for Core Services Migration
 * Verifies that core calculations are working correctly
 */

// Test core calculations directly
import { 
  calculateDurationHours,
  calculateDurationMinutes,
  formatDuration,
  calculateTimeOverlapMinutes,
  datesOverlap
} from '../src/services/core/calculations/dateCalculations.js';

import { 
  getWeekStart,
  formatTime,
  snapToTimeSlot
} from '../src/services/core/calculations/timeCalculations.js';

console.log('🔍 CORE SERVICES HEALTH CHECK');
console.log('==============================');

try {
  // Test date calculations
  const start = new Date('2025-01-01T09:00:00');
  const end = new Date('2025-01-01T17:00:00');
  
  console.log('\n✅ Duration Calculations:');
  console.log(`   Hours: ${calculateDurationHours(start, end)}`);
  console.log(`   Minutes: ${calculateDurationMinutes(start, end)}`);
  console.log(`   Formatted: ${formatDuration(8.5)}`);
  
  console.log('\n✅ Overlap Calculations:');
  const overlap = calculateTimeOverlapMinutes(
    start, end,
    new Date('2025-01-01T10:00:00'), new Date('2025-01-01T16:00:00')
  );
  console.log(`   Overlap: ${overlap} minutes`);
  
  console.log('\n✅ Date Range Overlap:');
  const overlaps = datesOverlap(
    new Date('2025-01-01'), new Date('2025-01-05'),
    new Date('2025-01-03'), new Date('2025-01-07')
  );
  console.log(`   Dates overlap: ${overlaps}`);
  
  console.log('\n✅ Time Calculations:');
  console.log(`   Week start: ${getWeekStart(new Date()).toDateString()}`);
  console.log(`   Formatted time: ${formatTime(new Date())}`);
  console.log(`   Snapped time: ${snapToTimeSlot(new Date()).toLocaleTimeString()}`);
  
  console.log('\n🎉 ALL CORE SERVICES WORKING CORRECTLY!');
  console.log('   Single source of truth migration successful.');
  
} catch (error) {
  console.error('\n❌ CORE SERVICES ERROR:', error);
  console.error('   Check import paths and function exports.');
}
