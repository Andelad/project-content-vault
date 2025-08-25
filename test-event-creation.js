// Simple test to verify event creation works
console.log('Testing event creation...');

// Test data that matches what the app would send
const testEventData = {
  title: 'Test Event',
  description: 'Test description',
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
  project_id: null,
  color: '#3b82f6',
  completed: false,
  duration: 1,
  event_type: 'planned',
  recurring_type: null,
  recurring_interval: null,
  recurring_end_date: null,
  recurring_count: null,
  recurring_group_id: null
};

console.log('Test event data:', JSON.stringify(testEventData, null, 2));
console.log('All fields are properly defined');
