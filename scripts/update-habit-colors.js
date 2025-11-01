/**
 * Migration script to update all existing habits to use OKLCH brown color
 * Run this once to update the color field for all habit category events
 */

import { createClient } from '@supabase/supabase-js';

const OKLCH_HABIT_BROWN = 'oklch(0.76 0.15 40)';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateHabitColors() {
  console.log('Starting habit color migration...');
  console.log(`Target color: ${OKLCH_HABIT_BROWN}`);
  
  try {
    // First, check how many habits need updating
    const { data: habitsToUpdate, error: countError } = await supabase
      .from('calendar_events')
      .select('id, title, color')
      .eq('category', 'habit');
    
    if (countError) {
      throw countError;
    }
    
    console.log(`Found ${habitsToUpdate?.length || 0} habits in the database`);
    
    if (!habitsToUpdate || habitsToUpdate.length === 0) {
      console.log('No habits found to update');
      return;
    }
    
    // Show which habits will be updated
    console.log('\nHabits to update:');
    habitsToUpdate.forEach((habit, index) => {
      console.log(`  ${index + 1}. "${habit.title}" (current color: ${habit.color || 'none'})`);
    });
    
    // Update all habits to use the new brown color
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ color: OKLCH_HABIT_BROWN })
      .eq('category', 'habit')
      .select();
    
    if (error) {
      throw error;
    }
    
    console.log(`\n✓ Successfully updated ${data?.length || 0} habits to brown color`);
    console.log('Migration complete!');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

updateHabitColors();
