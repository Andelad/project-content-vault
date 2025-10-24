/**
 * Migration Script: Update Project Colors to Uniform Palette
 * 
 * This script updates all existing project colors to use the new uniform
 * OKLCH color palette with consistent lightness (0.65) and chroma (0.15).
 * 
 * IMPORTANT: Set your Supabase credentials as environment variables:
 * export VITE_SUPABASE_URL="your-url"
 * export VITE_SUPABASE_ANON_KEY="your-key"
 * 
 * Then run with: node scripts/migrate-project-colors.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('   VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? 'set' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// New uniform color palette (12 colors at 30-degree intervals)
const OKLCH_PROJECT_COLORS = [
  'oklch(0.65 0.15 0)',     // Red
  'oklch(0.65 0.15 30)',    // Orange
  'oklch(0.65 0.15 60)',    // Yellow-Orange
  'oklch(0.65 0.15 90)',    // Yellow
  'oklch(0.65 0.15 120)',   // Yellow-Green
  'oklch(0.65 0.15 150)',   // Green
  'oklch(0.65 0.15 180)',   // Cyan
  'oklch(0.65 0.15 210)',   // Sky Blue
  'oklch(0.65 0.15 240)',   // Blue
  'oklch(0.65 0.15 270)',   // Purple
  'oklch(0.65 0.15 300)',   // Magenta
  'oklch(0.65 0.15 330)',   // Pink
];

// Old color palette for matching
const OLD_OKLCH_COLORS = [
  'oklch(0.65 0.15 25)',   // Warm red -> 0
  'oklch(0.65 0.15 45)',   // Orange -> 30
  'oklch(0.65 0.15 85)',   // Yellow -> 90
  'oklch(0.65 0.15 145)',  // Lime green -> 120
  'oklch(0.65 0.15 165)',  // Green -> 150
  'oklch(0.65 0.15 205)',  // Teal -> 210
  'oklch(0.65 0.15 245)',  // Blue -> 240
  'oklch(0.65 0.15 285)',  // Purple -> 270
  'oklch(0.65 0.15 325)',  // Pink -> 330
  'oklch(0.65 0.15 15)',   // Deep red -> 0
  'oklch(0.55 0.08 25)',   // Muted red -> 0
  'oklch(0.55 0.08 85)',   // Muted yellow -> 90
  'oklch(0.55 0.08 165)',  // Muted green -> 150
  'oklch(0.55 0.08 245)',  // Muted blue -> 240
  'oklch(0.55 0.08 325)',  // Muted pink -> 330
];

// Map old colors to new colors based on hue
const OLD_TO_NEW_MAP = {
  'oklch(0.65 0.15 25)': 'oklch(0.65 0.15 30)',    // Warm red -> Orange
  'oklch(0.65 0.15 45)': 'oklch(0.65 0.15 30)',    // Orange -> Orange
  'oklch(0.65 0.15 85)': 'oklch(0.65 0.15 90)',    // Yellow -> Yellow
  'oklch(0.65 0.15 145)': 'oklch(0.65 0.15 150)',  // Lime green -> Green
  'oklch(0.65 0.15 165)': 'oklch(0.65 0.15 150)',  // Green -> Green
  'oklch(0.65 0.15 205)': 'oklch(0.65 0.15 210)',  // Teal -> Sky Blue
  'oklch(0.65 0.15 245)': 'oklch(0.65 0.15 240)',  // Blue -> Blue
  'oklch(0.65 0.15 285)': 'oklch(0.65 0.15 270)',  // Purple -> Purple
  'oklch(0.65 0.15 325)': 'oklch(0.65 0.15 330)',  // Pink -> Pink
  'oklch(0.65 0.15 15)': 'oklch(0.65 0.15 0)',     // Deep red -> Red
  'oklch(0.55 0.08 25)': 'oklch(0.65 0.15 0)',     // Muted red -> Red
  'oklch(0.55 0.08 85)': 'oklch(0.65 0.15 90)',    // Muted yellow -> Yellow
  'oklch(0.55 0.08 165)': 'oklch(0.65 0.15 150)',  // Muted green -> Green
  'oklch(0.55 0.08 245)': 'oklch(0.65 0.15 240)',  // Muted blue -> Blue
  'oklch(0.55 0.08 325)': 'oklch(0.65 0.15 330)',  // Muted pink -> Pink
};

function findClosestNewColor(oldColor) {
  // Check if exact mapping exists
  if (OLD_TO_NEW_MAP[oldColor]) {
    return OLD_TO_NEW_MAP[oldColor];
  }

  // Extract hue from OKLCH color
  const match = oldColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) {
    console.warn(`⚠️  Could not parse color: ${oldColor}, using default`);
    return OKLCH_PROJECT_COLORS[0];
  }

  const [, , , hue] = match;
  const hueValue = parseFloat(hue);

  // Find closest hue in new palette (0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330)
  const newHues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  let closestHue = newHues[0];
  let minDiff = Math.abs(hueValue - closestHue);

  for (const newHue of newHues) {
    const diff = Math.abs(hueValue - newHue);
    if (diff < minDiff) {
      minDiff = diff;
      closestHue = newHue;
    }
  }

  return `oklch(0.65 0.15 ${closestHue})`;
}

async function migrateProjectColors() {
  console.log('🎨 Starting project color migration...\n');

  try {
    // Fetch all projects
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('id, name, color');

    if (fetchError) {
      throw fetchError;
    }

    if (!projects || projects.length === 0) {
      console.log('✅ No projects found to migrate');
      return;
    }

    console.log(`📊 Found ${projects.length} projects\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    for (const project of projects) {
      const oldColor = project.color;
      const newColor = findClosestNewColor(oldColor);

      if (oldColor === newColor) {
        console.log(`⏭️  ${project.name}: Already using new color (${oldColor})`);
        skippedCount++;
      } else {
        console.log(`✏️  ${project.name}: ${oldColor} → ${newColor}`);
        updates.push({ id: project.id, color: newColor });
        updatedCount++;
      }
    }

    if (updates.length === 0) {
      console.log('\n✅ All projects already use the new color palette!');
      return;
    }

    console.log(`\n📝 Updating ${updates.length} projects...`);

    // Update all projects
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ color: update.color })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Failed to update project ${update.id}:`, updateError);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Updated: ${updatedCount} projects`);
    console.log(`   Skipped: ${skippedCount} projects`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateProjectColors()
  .then(() => {
    console.log('\n✨ All done! Please refresh your app to see the updated colors.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
