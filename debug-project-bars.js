// Quick test to check project data structure and fix orphaned projects
// This will help identify why project bars aren't showing on timeline

console.log('🔍 STARTING PROJECT DEBUG ANALYSIS...');

// Wait for the page to load, then run this in browser console
setTimeout(() => {
  // Check if projects exist
  const projects = window.__projectDebugData?.projects || [];
  const rows = window.__projectDebugData?.rows || [];
  const groups = window.__projectDebugData?.groups || [];
  
  console.log('📊 CURRENT DATA STATE:');
  console.log(`Projects: ${projects.length}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Groups: ${groups.length}`);
  
  if (projects.length === 0) {
    console.log('❌ NO PROJECTS FOUND - This explains why no project bars appear');
    console.log('📝 SOLUTION: Create a project on the timeline or projects page');
    return;
  }
  
  // Check for orphaned projects
  const orphanedProjects = projects.filter(p => !p.rowId || !p.groupId);
  console.log(`🚨 ORPHANED PROJECTS: ${orphanedProjects.length}`);
  
  if (orphanedProjects.length > 0) {
    console.log('📋 Orphaned project details:');
    orphanedProjects.forEach(p => {
      console.log(`  - ${p.name} (rowId: ${p.rowId}, groupId: ${p.groupId})`);
    });
    
    console.log('🔧 SOLUTION: Fix orphaned projects by assigning them to rows');
  }
  
  // Check for projects with valid assignments
  const validProjects = projects.filter(p => p.rowId && p.groupId);
  console.log(`✅ VALID PROJECTS: ${validProjects.length}`);
  
  if (validProjects.length > 0) {
    console.log('📋 Valid project details:');
    validProjects.forEach(p => {
      const matchingRow = rows.find(r => r.id === p.rowId);
      const matchingGroup = groups.find(g => g.id === p.groupId);
      console.log(`  - ${p.name} → Row: ${matchingRow?.name || 'NOT FOUND'}, Group: ${matchingGroup?.name || 'NOT FOUND'}`);
      console.log(`    Dates: ${p.startDate} to ${p.endDate}`);
    });
  }
  
}, 2000);
