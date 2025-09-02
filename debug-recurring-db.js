// Test script to check database for recurring events

console.log('Checking database for recurring events...');

// Simulate a database query to check for recurring events
// This would normally use supabase client, but we'll just log what the query should be

const testQueries = [
  {
    name: 'Check all events',
    query: 'SELECT * FROM calendar_events ORDER BY start_time ASC'
  },
  {
    name: 'Check events with recurring_group_id',
    query: 'SELECT * FROM calendar_events WHERE recurring_group_id IS NOT NULL ORDER BY start_time ASC'
  },
  {
    name: 'Check events with recurring metadata',
    query: 'SELECT * FROM calendar_events WHERE recurring_type IS NOT NULL ORDER BY start_time ASC'
  },
  {
    name: 'Count events by recurring_group_id',
    query: 'SELECT recurring_group_id, COUNT(*) as count FROM calendar_events WHERE recurring_group_id IS NOT NULL GROUP BY recurring_group_id'
  }
];

testQueries.forEach(test => {
  console.log(`\n${test.name}:`);
  console.log(test.query);
});

console.log('\nTo run these queries in the browser console:');
console.log('1. Open developer tools');
console.log('2. Navigate to the Application tab');
console.log('3. Use the Supabase client to run queries like:');
console.log('   await supabase.from("calendar_events").select("*").order("start_time", { ascending: true })');

// Test data structure for a recurring event
const sampleRecurringEvent = {
  title: 'Weekly Meeting',
  description: 'Team standup',
  start_time: '2025-09-02T10:00:00.000Z',
  end_time: '2025-09-02T11:00:00.000Z',
  project_id: null,
  color: '#3b82f6',
  completed: false,
  duration: 1,
  event_type: 'planned',
  recurring_group_id: 'test-group-123',
  recurring_type: 'weekly', // Only on first event
  recurring_interval: 1,     // Only on first event
  recurring_end_date: null,  // Only on first event
  recurring_count: 4         // Only on first event
};

console.log('\nSample recurring event structure:');
console.log(JSON.stringify(sampleRecurringEvent, null, 2));

console.log('\nExpected database entries for 4 weekly events:');
for (let i = 0; i < 4; i++) {
  const eventDate = new Date('2025-09-02T10:00:00.000Z');
  eventDate.setDate(eventDate.getDate() + (i * 7)); // Add weeks
  
  const endDate = new Date(eventDate);
  endDate.setHours(endDate.getHours() + 1); // Add 1 hour
  
  const event = {
    title: 'Weekly Meeting',
    start_time: eventDate.toISOString(),
    end_time: endDate.toISOString(),
    recurring_group_id: 'test-group-123',
    recurring_type: i === 0 ? 'weekly' : null, // Only first event has metadata
    recurring_interval: i === 0 ? 1 : null,
    recurring_count: i === 0 ? 4 : null
  };
  
  console.log(`Event ${i + 1}:`, event);
}

console.log('\nDone!');
