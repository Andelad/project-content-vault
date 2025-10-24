/**
 * Utility to migrate project colors to the new uniform palette
 * Run this from the browser console or create a UI button to trigger it
 */

import { supabase } from '@/integrations/supabase/client';

// New uniform color palette (12 colors at 30-degree intervals)
const OKLCH_PROJECT_COLORS = [
  'oklch(0.72 0.15 0)',     // Red
  'oklch(0.72 0.15 30)',    // Orange
  'oklch(0.72 0.15 60)',    // Yellow-Orange
  'oklch(0.72 0.15 90)',    // Yellow
  'oklch(0.72 0.15 120)',   // Yellow-Green
  'oklch(0.72 0.15 150)',   // Green
  'oklch(0.72 0.15 180)',   // Cyan
  'oklch(0.72 0.15 210)',   // Sky Blue
  'oklch(0.72 0.15 240)',   // Blue
  'oklch(0.72 0.15 270)',   // Purple
  'oklch(0.72 0.15 300)',   // Magenta
  'oklch(0.72 0.15 330)',   // Pink
];

// Map old colors to new colors based on hue (includes all previous versions)
const OLD_TO_NEW_MAP: Record<string, string> = {
  // Old 0.65 lightness colors -> new 0.72 colors
  'oklch(0.65 0.15 0)': 'oklch(0.72 0.15 0)',
  'oklch(0.65 0.15 25)': 'oklch(0.72 0.15 30)',
  'oklch(0.65 0.15 30)': 'oklch(0.72 0.15 30)',
  'oklch(0.65 0.15 45)': 'oklch(0.72 0.15 30)',
  'oklch(0.65 0.15 60)': 'oklch(0.72 0.15 60)',
  'oklch(0.65 0.15 65)': 'oklch(0.72 0.15 60)',
  'oklch(0.65 0.15 85)': 'oklch(0.72 0.15 90)',
  'oklch(0.65 0.15 90)': 'oklch(0.72 0.15 90)',
  'oklch(0.65 0.15 105)': 'oklch(0.72 0.15 120)',
  'oklch(0.65 0.15 120)': 'oklch(0.72 0.15 120)',
  'oklch(0.65 0.15 145)': 'oklch(0.72 0.15 150)',
  'oklch(0.65 0.15 150)': 'oklch(0.72 0.15 150)',
  'oklch(0.65 0.15 165)': 'oklch(0.72 0.15 150)',
  'oklch(0.65 0.15 180)': 'oklch(0.72 0.15 180)',
  'oklch(0.65 0.15 185)': 'oklch(0.72 0.15 180)',
  'oklch(0.65 0.15 205)': 'oklch(0.72 0.15 210)',
  'oklch(0.65 0.15 210)': 'oklch(0.72 0.15 210)',
  'oklch(0.65 0.15 240)': 'oklch(0.72 0.15 240)',
  'oklch(0.65 0.15 245)': 'oklch(0.72 0.15 240)',
  'oklch(0.65 0.15 265)': 'oklch(0.72 0.15 270)',
  'oklch(0.65 0.15 270)': 'oklch(0.72 0.15 270)',
  'oklch(0.65 0.15 285)': 'oklch(0.72 0.15 270)',
  'oklch(0.65 0.15 300)': 'oklch(0.72 0.15 300)',
  'oklch(0.65 0.15 305)': 'oklch(0.72 0.15 300)',
  'oklch(0.65 0.15 325)': 'oklch(0.72 0.15 330)',
  'oklch(0.65 0.15 330)': 'oklch(0.72 0.15 330)',
  'oklch(0.65 0.15 15)': 'oklch(0.72 0.15 0)',
  // Old muted colors (0.55 lightness) -> new colors
  'oklch(0.55 0.08 25)': 'oklch(0.72 0.15 0)',
  'oklch(0.55 0.08 85)': 'oklch(0.72 0.15 90)',
  'oklch(0.55 0.08 165)': 'oklch(0.72 0.15 150)',
  'oklch(0.55 0.08 245)': 'oklch(0.72 0.15 240)',
  'oklch(0.55 0.08 325)': 'oklch(0.72 0.15 330)',
};

function findClosestNewColor(oldColor: string): string {
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

  return `oklch(0.72 0.15 ${closestHue})`;
}

export async function migrateProjectColors() {
  console.log('🎨 Starting project color migration...\n');

  try {
    // Fetch all projects for the current user
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('id, name, color');

    if (fetchError) {
      throw fetchError;
    }

    if (!projects || projects.length === 0) {
      console.log('✅ No projects found to migrate');
      return { success: true, updated: 0, skipped: 0 };
    }

    console.log(`📊 Found ${projects.length} projects\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updates: Array<{ id: string; name: string; oldColor: string; newColor: string }> = [];

    for (const project of projects) {
      const oldColor = project.color;
      const newColor = findClosestNewColor(oldColor);

      if (oldColor === newColor) {
        console.log(`⏭️  ${project.name}: Already using new color (${oldColor})`);
        skippedCount++;
      } else {
        console.log(`✏️  ${project.name}: ${oldColor} → ${newColor}`);
        updates.push({ id: project.id, name: project.name, oldColor, newColor });
        updatedCount++;
      }
    }

    if (updates.length === 0) {
      console.log('\n✅ All projects already use the new color palette!');
      return { success: true, updated: 0, skipped: skippedCount };
    }

    console.log(`\n📝 Updating ${updates.length} projects...`);

    // Update all projects
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ color: update.newColor })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Failed to update project ${update.name}:`, updateError);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Updated: ${updatedCount} projects`);
    console.log(`   Skipped: ${skippedCount} projects`);
    console.log('\n💡 Refresh the page to see the updated colors');

    return { success: true, updated: updatedCount, skipped: skippedCount, changes: updates };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error };
  }
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).migrateProjectColors = migrateProjectColors;
}
