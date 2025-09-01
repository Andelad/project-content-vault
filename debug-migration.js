#!/usr/bin/env node

/**
 * Debug Migration Issues - Comprehensive Test Script
 * 
 * This script will identify all potential issues from the legacy migration:
 * 1. Function signature mismatches
 * 2. Missing exports
 * 3. Import path issues
 * 4. Runtime dependency problems
 */

console.log('🔍 DEBUGGING MIGRATION ISSUES...\n');

// Test 1: Check if all expected exports are available
console.log('1️⃣ Testing Project Service Exports...');
try {
  // Test projects barrel export
  const projectsIndex = require('./src/services/projects/index.ts');
  console.log('✅ Projects index.ts loads successfully');
  
  // Test key functions
  const { 
    calculateProjectTimeMetrics, 
    buildPlannedTimeMap, 
    getPlannedTimeUpToDate,
    ProjectOrchestrator,
    ProjectValidator 
  } = projectsIndex;
  
  console.log('✅ Key functions exported:', {
    calculateProjectTimeMetrics: typeof calculateProjectTimeMetrics,
    buildPlannedTimeMap: typeof buildPlannedTimeMap,
    getPlannedTimeUpToDate: typeof getPlannedTimeUpToDate,
    ProjectOrchestrator: typeof ProjectOrchestrator,
    ProjectValidator: typeof ProjectValidator
  });

} catch (error) {
  console.error('❌ Projects export error:', error.message);
}

// Test 2: Check function signatures
console.log('\n2️⃣ Testing Function Signatures...');
try {
  const { buildPlannedTimeMap } = require('./src/services/projects/ProjectCalculations.ts');
  
  // Test with mock data
  const mockEvents = [
    { date: '2025-08-30', duration: 2, projectId: 'test' },
    { date: '2025-08-31', duration: 3, projectId: 'test' }
  ];
  
  // Test NEW signature (should only take events)
  const result = buildPlannedTimeMap(mockEvents);
  console.log('✅ buildPlannedTimeMap works with new signature');
  
} catch (error) {
  console.error('❌ Function signature error:', error.message);
}

// Test 3: Check component imports
console.log('\n3️⃣ Testing Component Imports...');
const componentsToTest = [
  './src/components/modals/ProjectModal.tsx',
  './src/components/projects/modal/ProjectProgressGraph.tsx', 
  './src/components/projects/modal/ProjectInsightsSection.tsx'
];

componentsToTest.forEach(componentPath => {
  try {
    require(componentPath);
    console.log(`✅ ${componentPath} imports successfully`);
  } catch (error) {
    console.error(`❌ ${componentPath} import error:`, error.message);
  }
});

// Test 4: Check for circular dependencies
console.log('\n4️⃣ Checking for Circular Dependencies...');
try {
  const madge = require('madge');
  madge('./src').then((res) => {
    const circular = res.circular();
    if (circular.length > 0) {
      console.error('❌ Circular dependencies found:', circular);
    } else {
      console.log('✅ No circular dependencies detected');
    }
  });
} catch (error) {
  console.log('⚠️  Madge not available, skipping circular dependency check');
}

console.log('\n5️⃣ Quick Fix Recommendations:');
console.log('- Check browser console for specific runtime errors');
console.log('- Verify all component imports resolve correctly'); 
console.log('- Compare legacy vs new function signatures');
console.log('- Test app in browser at http://localhost:8081');

console.log('\n🔧 To run this script: node debug-migration.js');
