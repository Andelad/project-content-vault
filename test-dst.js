// Test script to verify DST handling in recurring events
import { generateRecurringEvents } from './src/utils/recurringEvents.js';

function testDSTRecurring() {
  console.log('Testing DST handling in recurring events...');
  
  // Create a weekly recurring event that starts before BST ends (Oct 27, 2024)
  const startDate = new Date('2024-10-20T08:30:00'); // Sunday before BST ends
  const endDate = new Date('2024-10-20T09:30:00');
  
  const eventData = {
    title: 'Weekly Meeting',
    description: 'Test weekly meeting',
    startTime: startDate,
    endTime: endDate,
    projectId: null,
    color: '#3b82f6',
    completed: false,
    duration: 1,
    type: 'planned',
    recurring: {
      type: 'weekly',
      interval: 1,
      count: 4 // Generate 4 occurrences to cross DST boundary
    }
  };
  
  console.log('Original event start time:', startDate.toLocaleString('en-GB', { 
    timeZone: 'Europe/London',
    dateStyle: 'full',
    timeStyle: 'medium'
  }));
  
  const { events } = generateRecurringEvents(eventData);
  
  console.log('\nGenerated recurring events:');
  events.forEach((event, index) => {
    const londonTime = event.startTime.toLocaleString('en-GB', { 
      timeZone: 'Europe/London',
      dateStyle: 'full',
      timeStyle: 'medium'
    });
    const utcTime = event.startTime.toISOString();
    console.log(`${index + 1}. ${londonTime} (UTC: ${utcTime})`);
  });
  
  // Check if all events start at the same local time (8:30 AM London time)
  const londonTimes = events.map(event => {
    const londonDate = new Date(event.startTime.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    return `${londonDate.getHours()}:${londonDate.getMinutes().toString().padStart(2, '0')}`;
  });
  
  console.log('\nLocal times (should all be 8:30):');
  londonTimes.forEach((time, index) => {
    console.log(`Event ${index + 1}: ${time}`);
  });
  
  const allSameTime = londonTimes.every(time => time === '8:30');
  console.log(`\n✅ All events at same local time: ${allSameTime}`);
}

testDSTRecurring();
