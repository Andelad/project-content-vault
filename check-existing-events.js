// Check existing recurring events for DST issues
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bhnsswkcuvzncswmddey.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobnNzd2tjdXZ6bmNzd21kZGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MDE0NDksImV4cCI6MjA1MTI3NzQ0OX0.xmzlDdH7c-2RdOhyuJa-IlktL2rJl3zEIL5BOGUhI50';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExistingRecurringEvents() {
  console.log('Checking existing recurring events...');
  
  try {
    // Get all events that are part of recurring series
    const { data: recurringEvents, error } = await supabase
      .from('calendar_events')
      .select('*')
      .not('recurring_group_id', 'is', null)
      .order('recurring_group_id, start_time');
      
    if (error) throw error;
    
    if (!recurringEvents || recurringEvents.length === 0) {
      console.log('No recurring events found.');
      return;
    }
    
    // Group events by recurring_group_id
    const groupedEvents = recurringEvents.reduce((acc, event) => {
      if (!acc[event.recurring_group_id]) {
        acc[event.recurring_group_id] = [];
      }
      acc[event.recurring_group_id].push(event);
      return acc;
    }, {});
    
    console.log(`Found ${Object.keys(groupedEvents).length} recurring series:`);
    
    Object.entries(groupedEvents).forEach(([groupId, events]) => {
      console.log(`\nSeries ${groupId}:`);
      events.forEach((event, index) => {
        const startTime = new Date(event.start_time);
        const londonTime = startTime.toLocaleString('en-GB', {
          timeZone: 'Europe/London',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const utcTime = startTime.toLocaleString('en-GB', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        console.log(`  ${index + 1}. ${event.title}`);
        console.log(`     London: ${londonTime} | UTC: ${utcTime}`);
        console.log(`     Database: ${event.start_time}`);
      });
      
      // Check for time inconsistencies
      const londonTimes = events.map(event => {
        const date = new Date(event.start_time);
        return date.toLocaleString('en-GB', {
          timeZone: 'Europe/London',
          hour: '2-digit',
          minute: '2-digit'
        });
      });
      
      const uniqueTimes = [...new Set(londonTimes)];
      if (uniqueTimes.length > 1) {
        console.log(`     ⚠️  WARNING: Inconsistent local times detected!`);
        console.log(`     Times found: ${uniqueTimes.join(', ')}`);
        console.log(`     This series likely has DST issues.`);
      } else {
        console.log(`     ✅ All events at consistent local time: ${uniqueTimes[0]}`);
      }
    });
    
  } catch (error) {
    console.error('Error checking recurring events:', error);
  }
}

checkExistingRecurringEvents();
