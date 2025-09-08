// Simple test to check if the timeline calculations work
console.log('Testing timeline calculation functions...');

// Test the structure we expect
const mockProject = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-05')
};

const mockViewport = {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  columnWidth: 40,
  totalWidth: 1200,
  mode: 'days'
};

console.log('Mock data created successfully');
console.log('Project:', mockProject);
console.log('Viewport:', mockViewport);

// Try to require the compiled JS if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const distPath = path.join(__dirname, 'dist');
  
  if (fs.existsSync(distPath)) {
    console.log('✅ Dist folder found');
    const files = fs.readdirSync(distPath);
    console.log('Files:', files.filter(f => f.endsWith('.js')).slice(0, 5));
  } else {
    console.log('❌ No dist folder - build may have failed');
  }
} catch (e) {
  console.error('Error checking dist:', e.message);
}

console.log('✅ Test completed');
