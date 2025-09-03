import React from 'react';

// Smoke test for services
function ServiceTest() {
  try {
    // Test the import
    console.log('Testing projects services...');
    
    // This should work if our fixes are correct
    import('@/services').then((servicesModule) => {
      console.log('✅ Services loaded:', Object.keys(servicesModule));
      
      // Test the specific functions
      const { calculateProjectTimeMetrics } = servicesModule;
      console.log('✅ Functions available:', {
        calculateProjectTimeMetrics: typeof calculateProjectTimeMetrics
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
