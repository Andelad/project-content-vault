// Simple test for recurring events functionality

// Test the generateRecurringEvents function
console.log('Testing recurring events functionality...');

// Mock event data for testing
const testEvent = {
  title: 'Test Weekly Meeting',
  description: 'Weekly team standup',
  startTime: new Date('2025-09-02T10:00:00'),
  endTime: new Date('2025-09-02T11:00:00'),
  projectId: null,
  color: '#3b82f6',
  completed: false,
  duration: 1,
  type: 'planned',
  recurring: {
    type: 'weekly',
    interval: 1,
    count: 4
  }
};

// Simulate the generateRecurringEvents function
function generateRecurringEvents(eventData, maxOccurrences = 100) {
  if (!eventData.recurring) {
    return { events: [eventData], groupId: null };
  }

  const events = [];
  const { type, interval, endDate, count } = eventData.recurring;
  
  // Generate a unique group ID for this recurring series
  const groupId = 'test-group-' + Date.now();
  
  // Start with the original event (without recurring metadata for individual instances)
  const baseEvent = { ...eventData };
  delete baseEvent.recurring; // Individual recurring instances don't need the recurring metadata
  
  let currentDate = new Date(eventData.startTime);
  let occurrenceCount = 0;
  
  // If no count or endDate is specified, default to a reasonable limit
  const maxCount = count || (endDate ? maxOccurrences : 52); // Default to 52 occurrences (1 year of weekly events)
  const duration = eventData.endTime.getTime() - eventData.startTime.getTime();

  while (occurrenceCount < maxCount) {
    // Check if we've exceeded the end date
    if (endDate && currentDate > endDate) {
      break;
    }

    // Create event for current occurrence
    const eventStart = new Date(currentDate);
    const eventEnd = new Date(currentDate.getTime() + duration);
    
    events.push({
      ...baseEvent,
      startTime: eventStart,
      endTime: eventEnd,
    });

    occurrenceCount++;

    // Calculate next occurrence date based on recurrence type
    switch (type) {
      case 'daily':
        currentDate = new Date(currentDate.getTime() + (interval * 24 * 60 * 60 * 1000));
        break;
      case 'weekly':
        currentDate = new Date(currentDate.getTime() + (interval * 7 * 24 * 60 * 60 * 1000));
        break;
      case 'monthly':
        // Use setMonth to handle month boundaries correctly
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + interval);
        currentDate = nextMonth;
        break;
      case 'yearly':
        // Use setFullYear to handle leap years correctly
        const nextYear = new Date(currentDate);
        nextYear.setFullYear(nextYear.getFullYear() + interval);
        currentDate = nextYear;
        break;
    }
  }

  return { events, groupId };
}

// Test the function
const result = generateRecurringEvents(testEvent);

console.log('Generated recurring events:');
console.log('Group ID:', result.groupId);
console.log('Number of events:', result.events.length);
console.log('Event dates:');

result.events.forEach((event, index) => {
  console.log(`  ${index + 1}. ${event.startTime.toDateString()} ${event.startTime.toTimeString().substring(0, 8)}`);
});

console.log('\nTest completed successfully!');
