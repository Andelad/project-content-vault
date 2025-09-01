import React from 'react';

// Smoke test for services
function ServiceTest() {
  try {
    // Test the import
    console.log('Testing projects services...');
    
    // This should work if our fixes are correct
    import('@/services/projects').then((projectsModule) => {
      console.log('✅ Projects services loaded:', Object.keys(projectsModule));
      
      // Test the specific functions
      const { calculateProjectTimeMetrics, buildPlannedTimeMap, getPlannedTimeUpToDate } = projectsModule;
      console.log('✅ Functions available:', {
        calculateProjectTimeMetrics: typeof calculateProjectTimeMetrics,
        buildPlannedTimeMap: typeof buildPlannedTimeMap,
        getPlannedTimeUpToDate: typeof getPlannedTimeUpToDate
      });
    }).catch(err => {
      console.error('❌ Failed to load projects services:', err);
    });
    
  } catch (error) {
    console.error('❌ Service test failed:', error);
  }
  
  return <div>Service Test - Check Console</div>;
}

export default ServiceTest;
