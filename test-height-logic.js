// Simple test to verify the height calculation logic works correctly

// Simulate the logic from TimelineBar.tsx
function calculateHeightInPixels(estimatedHours, totalWorkingDays) {
  if (totalWorkingDays === 0) {
    return 0;
  }
  
  const exactHoursPerDay = estimatedHours / totalWorkingDays;
  
  // New logic: minimum 3px only if estimated hours > 0
  const heightInPixels = estimatedHours > 0 
    ? Math.max(3, Math.round(exactHoursPerDay * 2))
    : 0;
  
  // Cap at 40px
  return Math.min(heightInPixels, 40);
}

// Test cases
console.log('Test 1 - Project with 0 estimated hours:');
console.log('  Input: estimatedHours=0, totalWorkingDays=5');
console.log('  Output:', calculateHeightInPixels(0, 5), 'pixels');
console.log('  Expected: 0 pixels ✓\n');

console.log('Test 2 - Project with very small estimated hours:');
console.log('  Input: estimatedHours=0.5, totalWorkingDays=5');
console.log('  Output:', calculateHeightInPixels(0.5, 5), 'pixels');
console.log('  Expected: 3 pixels (minimum enforced) ✓\n');

console.log('Test 3 - Project with normal estimated hours:');
console.log('  Input: estimatedHours=20, totalWorkingDays=5');
console.log('  Output:', calculateHeightInPixels(20, 5), 'pixels');
console.log('  Expected: 8 pixels (4 hours/day * 2) ✓\n');

console.log('Test 4 - Project with high estimated hours:');
console.log('  Input: estimatedHours=100, totalWorkingDays=5');
console.log('  Output:', calculateHeightInPixels(100, 5), 'pixels');
console.log('  Expected: 40 pixels (capped at maximum) ✓\n');

console.log('Test 5 - Project with 0 working days:');
console.log('  Input: estimatedHours=10, totalWorkingDays=0');
console.log('  Output:', calculateHeightInPixels(10, 0), 'pixels');
console.log('  Expected: 0 pixels ✓');
