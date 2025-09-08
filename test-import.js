// Test PlannerV2CalculationService import
try {
  const services = require('./src/services/index.ts');
  console.log('Available services:', Object.keys(services));
  console.log('PlannerV2CalculationService available:', 'PlannerV2CalculationService' in services);
} catch (error) {
  console.error('Import error:', error.message);
}
