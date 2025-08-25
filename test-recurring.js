// Manual test for recurring events functionality
import { generateRecurringEvents } from './src/utils/recurringEvents.js';

// Test data
const testEvent = {
  title: 'Weekly Team Meeting',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T11:00:00Z'),
  color: '#3b82f6',
  completed: false,
  duration: 1,
  type: 'planned',
  recurring: {
    type: 'weekly',
    interval: 1,
    count: 5
  }
};

console.log('Testing weekly recurring events...');
const events = generateRecurringEvents(testEvent);
console.log(`Generated ${events.length} events:`);

events.forEach((event, index) => {
  console.log(`${index + 1}. ${event.title} - ${event.startTime.toISOString()} to ${event.endTime.toISOString()}`);
});

// Test monthly recurrence
const monthlyEvent = {
  ...testEvent,
  title: 'Monthly Review',
  recurring: {
    type: 'monthly',
    interval: 1,
    count: 3
  }
};

console.log('\nTesting monthly recurring events...');
const monthlyEvents = generateRecurringEvents(monthlyEvent);
console.log(`Generated ${monthlyEvents.length} events:`);

monthlyEvents.forEach((event, index) => {
  console.log(`${index + 1}. ${event.title} - ${event.startTime.toISOString()} to ${event.endTime.toISOString()}`);
});

console.log('\nRecurring events test completed!');
