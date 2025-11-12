/**
 * Fix Unallocated Event Colors Script
 * Updates all events without a project to use neutral gray color
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OKLCH_FALLBACK_GRAY = 'oklch(0.76 0 0)';

async function fixUnallocatedEventColors() {
  console.log('🔍 Finding events without projects...\n');

  // Get all events without a project_id
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('id, title, color, project_id')
    .is('project_id', null);

  if (error) {
    console.error('❌ Error fetching events:', error);
    return;
  }

  if (!events || events.length === 0) {
    console.log('✅ No unallocated events found');
    return;
  }

  console.log(`📋 Found ${events.length} unallocated events:\n`);
  
  events.forEach(event => {
    console.log(`  • ${event.title} - Current color: ${event.color}`);
  });

  console.log(`\n🎨 Updating all to gray: ${OKLCH_FALLBACK_GRAY}\n`);

  // Update all unallocated events to gray
  const { data: updated, error: updateError } = await supabase
    .from('calendar_events')
    .update({ color: OKLCH_FALLBACK_GRAY })
    .is('project_id', null)
    .select();

  if (updateError) {
    console.error('❌ Error updating events:', updateError);
    return;
  }

  console.log(`✅ Successfully updated ${updated?.length || 0} events to gray!\n`);
  
  if (updated && updated.length > 0) {
    console.log('Updated events:');
    updated.forEach(event => {
      console.log(`  ✓ ${event.title}`);
    });
  }
}

// Run the script
fixUnallocatedEventColors()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
