/**
 * Batch Migration Script: Convert Legacy Recurring Events to RRULE
 * 
 * This script converts all legacy recurring events (using recurring_type/recurring_interval)
 * to the new RRULE standard format.
 * 
 * Run with: node scripts/migrate-recurring-to-rrule.js
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hhzmaadhndtrvgnqujnn.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/migrate-recurring-to-rrule.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Convert legacy recurring event data to RRULE string
 */
function convertLegacyToRRule(recurringType, interval = 1, endDate, count) {
  const parts = [];
  
  parts.push(`FREQ=${recurringType.toUpperCase()}`);
  parts.push(`INTERVAL=${interval}`);
  
  if (endDate) {
    const untilStr = new Date(endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${untilStr}`);
  }
  
  if (count) {
    parts.push(`COUNT=${count}`);
  }
  
  return parts.join(';');
}

/**
 * Main migration function
 */
async function migrateRecurringEvents() {
  console.log('🚀 Starting RRULE migration...\n');

  try {
    // Fetch all events with legacy recurring format (has recurring_type but no rrule)
    const { data: legacyEvents, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .not('recurring_type', 'is', null)
      .is('rrule', null);

    if (fetchError) throw fetchError;

    if (!legacyEvents || legacyEvents.length === 0) {
      console.log('✅ No legacy recurring events found. Migration complete!');
      return;
    }

    console.log(`📊 Found ${legacyEvents.length} legacy recurring events to migrate\n`);

    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    // Process each event
    for (const event of legacyEvents) {
      try {
        const rrule = convertLegacyToRRule(
          event.recurring_type,
          event.recurring_interval || 1,
          event.recurring_end_date,
          event.recurring_count
        );

        // Update event with RRULE
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({ rrule })
          .eq('id', event.id);

        if (updateError) throw updateError;

        successCount++;
        console.log(`✓ Migrated event ${event.id}: ${event.title}`);
        console.log(`  Legacy: ${event.recurring_type} every ${event.recurring_interval || 1}`);
        console.log(`  RRULE: ${rrule}\n`);
      } catch (error) {
        failureCount++;
        failures.push({ event, error: error.message });
        console.error(`✗ Failed to migrate event ${event.id}: ${error.message}\n`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total events processed: ${legacyEvents.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\n❌ Failed Events:');
      failures.forEach(({ event, error }) => {
        console.log(`  - ${event.id} (${event.title}): ${error}`);
      });
    }

    console.log('\n✅ Migration completed!');
    console.log('\nNote: Legacy columns (recurring_type, recurring_interval, etc.) are preserved');
    console.log('for rollback safety. They can be removed in a future migration if needed.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateRecurringEvents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
