// Test script to verify recurring events delete functionality
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = 'https://bhnsswkcuvzncswmddey.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobnNzd2tjdXZ6bmNzd21kZGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MDE0NDksImV4cCI6MjA1MTI3NzQ0OX0.xmzlDdH7c-2RdOhyuJa-IlktL2rJl3zEIL5BOGUhI50';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRecurringEvents() {
  console.log('Testing recurring events...');
  
  try {
    // Create a recurring event series
    const groupId = randomUUID();
    const baseTime = new Date('2025-01-01T10:00:00');
    
    // Create 3 events in the series
    const events = [];
    for (let i = 0; i < 3; i++) {
      const startTime = new Date(baseTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000)); // Weekly
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour
      
      const event = {
        title: `Test Weekly Meeting ${i + 1}`,
        description: 'Test recurring event',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        project_id: null,
        color: '#3b82f6',
        completed: false,
        duration: 1,
        event_type: 'planned',
        recurring_group_id: groupId,
        recurring_type: i === 0 ? 'weekly' : null,
        recurring_interval: i === 0 ? 1 : null,
        recurring_end_date: null,
        recurring_count: i === 0 ? 3 : null
      };
      
      const { data: createdEvent, error } = await supabase
        .from('calendar_events')
        .insert(event)
        .select()
        .single();
        
      if (error) throw error;
      events.push(createdEvent);
      console.log(`Created event ${i + 1}: ${createdEvent.id}`);
    }
    
    console.log(`\nCreated ${events.length} events with group ID: ${groupId}`);
    
    // Test getting recurring group events
    console.log('\nTesting getRecurringGroupEvents...');
    const testEventId = events[1].id; // Use the second event
    
    // Get the target event to find its recurring_group_id
    const { data: targetEventData, error: targetError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', testEventId)
      .single();
      
    if (targetError || !targetEventData) {
      throw new Error('Could not find target event');
    }
    
    console.log(`Target event has recurring_group_id: ${targetEventData.recurring_group_id}`);
    
    // Find all events with the same recurring_group_id
    const { data: groupEvents, error: groupError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('recurring_group_id', targetEventData.recurring_group_id)
      .order('start_time', { ascending: true });
      
    if (groupError) throw groupError;
    
    console.log(`Found ${groupEvents.length} events in the recurring group:`);
    groupEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.title} (${event.id}) - ${event.start_time}`);
    });
    
    // Test delete future events
    console.log('\nTesting delete future events...');
    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurring_group_id', targetEventData.recurring_group_id)
      .gte('start_time', targetEventData.start_time);
      
    if (deleteError) throw deleteError;
    
    // Check remaining events
    const { data: remainingEvents, error: remainingError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('recurring_group_id', targetEventData.recurring_group_id);
      
    if (remainingError) throw remainingError;
    
    console.log(`Remaining events after delete future: ${remainingEvents.length}`);
    remainingEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.title} (${event.id}) - ${event.start_time}`);
    });
    
    // Clean up - delete all remaining events
    console.log('\nCleaning up...');
    const { error: cleanupError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurring_group_id', groupId);
      
    if (cleanupError) throw cleanupError;
    console.log('Cleanup complete.');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testRecurringEvents();
