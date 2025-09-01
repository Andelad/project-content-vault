#!/usr/bin/env node

// Quick test script to see what's actually being exported
const path = require('path');

console.log('🔍 Testing Project Services Exports...\n');

// Test each export individually
const testPaths = [
  './src/services/projects/ProjectCalculations.ts',
  './src/services/projects/ProjectOrchestrator.ts', 
  './src/services/projects/ProjectValidator.ts',
  './src/services/projects/ProjectRepository.ts',
  './src/services/projects/index.ts'
];

testPaths.forEach(testPath => {
  try {
    const modulePath = path.resolve(testPath);
    delete require.cache[modulePath]; // Clear cache
    const module = require(modulePath);
    console.log(`✅ ${testPath}:`, Object.keys(module).slice(0, 10));
  } catch (error) {
    console.error(`❌ ${testPath}:`, error.message);
  }
});

console.log('\n🔍 Testing specific functions...');
try {
  const projects = require('./src/services/projects/index.ts');
  const { calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate } = projects;
  
  console.log('Functions found:', {
    calculateProjectTimeMetrics: typeof calculateProjectTimeMetrics,
    buildPlannedTimeMap: typeof buildPlannedTimeMap, 
    getPlannedTimeUpToDate: typeof getPlannedTimeUpToDate
  });
  
  // Test function signatures
  if (typeof buildPlannedTimeMap === 'function') {
    console.log('buildPlannedTimeMap.length:', buildPlannedTimeMap.length, '(should be 1 or 2)');
  }
  if (typeof getPlannedTimeUpToDate === 'function') {
    console.log('getPlannedTimeUpToDate.length:', getPlannedTimeUpToDate.length, '(should be 2)');
  }
  
} catch (error) {
  console.error('❌ Function test failed:', error.message);
}
