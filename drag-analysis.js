/**
 * Drag System Analysis - Identifying Stutter-Step Sources
 */

console.log('🔍 Drag System Analysis');
console.log('======================');
console.log('');

console.log('📋 Two Drag Systems Identified:');
console.log('');

console.log('1. PROJECT BAR DRAG (TimelineView.tsx):');
console.log('   Purpose: Move entire project + all milestones together');
console.log('   Trigger: Drag project baseline, start circle, or end triangle');
console.log('   Calculation: calculateDaysDelta() → single daysDelta for all elements');
console.log('   Updates: Project dates + all milestone dates with same daysDelta');
console.log('   Expected: All elements move in perfect unison');
console.log('');

console.log('2. INDIVIDUAL MILESTONE DRAG (ProjectMilestones.tsx):');
console.log('   Purpose: Reposition single milestone within project');
console.log('   Trigger: Drag individual milestone marker');
console.log('   Calculation: Independent deltaX / dayWidth per milestone');
console.log('   Updates: Only the dragged milestone');
console.log('   Expected: Single milestone moves, others stay fixed');
console.log('');

console.log('🐛 POTENTIAL STUTTER-STEP SOURCES:');
console.log('');

console.log('A. CALCULATION MISMATCH:');
console.log('   - dragUtils.ts was using old floating-point calculation');
console.log('   - Fixed: Now uses 11px consistently with positioning system');
console.log('   - Status: ✅ FIXED');
console.log('');

console.log('B. TIMING SYNCHRONIZATION:');
console.log('   - Project bar updates via TimelineView drag handler');
console.log('   - Milestones update via React state/props changes');
console.log('   - Potential: React render timing differences');
console.log('   - Status: ⚠️ NEEDS INVESTIGATION');
console.log('');

console.log('C. POSITIONING COORDINATE SYSTEMS:');
console.log('   - Project bar: Uses calculateTimelinePositions()');
console.log('   - Milestones: Use projectPositions + day offsets');
console.log('   - Should be: Perfectly synchronized');
console.log('   - Status: ✅ SHOULD BE FIXED');
console.log('');

console.log('D. DRAG STATE PROPAGATION:');
console.log('   - TimelineView calculates daysDelta');
console.log('   - Updates project via updateProject()');
console.log('   - Milestones re-render based on updated project.startDate');
console.log('   - Potential: Async state update delays');
console.log('   - Status: ⚠️ SUSPECT');
console.log('');

console.log('🎯 DIAGNOSTIC STEPS:');
console.log('');

console.log('1. Test in browser dev tools:');
console.log('   - Drag project bar slowly');
console.log('   - Watch for milestone position delays');
console.log('   - Check if all milestones stutter or just some');
console.log('');

console.log('2. Add debug logging:');
console.log('   - Log daysDelta in TimelineView');
console.log('   - Log milestone position updates');
console.log('   - Compare timing of updates');
console.log('');

console.log('3. Verify calculation consistency:');
console.log('   - Ensure dragUtils uses 11px');
console.log('   - Ensure positioning uses 11px');
console.log('   - Ensure no floating-point drift');
console.log('');

console.log('💡 LIKELY SOLUTION:');
console.log('');
console.log('Most probable cause: React state update delays');
console.log('');
console.log('During project drag:');
console.log('1. calculateDaysDelta() determines movement');
console.log('2. updateProject() changes project.startDate');
console.log('3. React re-renders TimelineBar with new dates');
console.log('4. Milestones recalculate positions based on new project.startDate');
console.log('');
console.log('The delay between steps 2→3→4 could cause visual lag.');
console.log('');
console.log('Potential fix: Pass daysDelta directly to milestones');
console.log('so they can move immediately without waiting for React updates.');
