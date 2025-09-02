// Simple test to check if we can delete events
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = 'https://bhnsswkcuvzncswmddey.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobnNzd2tjdXZ6bmNzd21kZGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MDE0NDksImV4cCI6MjA1MTI3NzQ0OX0.xmzlDdH7c-2RdOhyuJa-IlktL2rJl3zEIL5BOGUhI50';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelete() {
  console.log('Testing delete functionality...');
  
  try {
    // First, create a test event
    const testEvent = {
      title: 'Test Delete Event',
      description: 'This is a test event for deletion',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      project_id: null,
      color: '#ff0000',
      completed: false,
      duration: 1,
      event_type: 'planned',
      recurring_group_id: randomUUID()
    };
    
    console.log('Creating test event...');
    const { data: createdEvent, error: createError } = await supabase
      .from('calendar_events')
      .insert(testEvent)
      .select()
      .single();
      
    if (createError) {
      console.error('Failed to create test event:', createError);
      return;
    }
    
    console.log('Created test event:', createdEvent.id);
    
    // Try to delete it
    console.log('Attempting to delete event...');
    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', createdEvent.id);
      
    if (deleteError) {
      console.error('Failed to delete event:', deleteError);
    } else {
      console.log('Successfully deleted event');
    }
    
    // Check if it was actually deleted
    const { data: checkEvent, error: checkError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', createdEvent.id)
      .single();
      
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        console.log('✅ Event was successfully deleted (not found)');
      } else {
        console.error('Error checking if event was deleted:', checkError);
      }
    } else if (checkEvent) {
      console.log('❌ Event still exists after delete attempt');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDelete();
