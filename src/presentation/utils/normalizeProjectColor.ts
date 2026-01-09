/**
 * Color normalization utility
 * Automatically converts old project colors to the new uniform palette
 */

import { OKLCH_PROJECT_COLORS } from '@/presentation/constants/colors';

type ProjectPaletteColor = (typeof OKLCH_PROJECT_COLORS)[number];

const isProjectPaletteColor = (color: string): color is ProjectPaletteColor =>
  (OKLCH_PROJECT_COLORS as readonly string[]).includes(color);

// Map old colors to new colors based on hue (includes all previous versions)
const OLD_TO_NEW_MAP: Record<string, string> = {
  // Old 0.72 lightness colors -> new 0.76 colors
  'oklch(0.72 0.15 0)': 'oklch(0.76 0.15 0)',
  'oklch(0.72 0.15 30)': 'oklch(0.76 0.15 30)',
  'oklch(0.72 0.15 60)': 'oklch(0.76 0.15 60)',
  'oklch(0.72 0.15 90)': 'oklch(0.76 0.15 90)',
  'oklch(0.72 0.15 120)': 'oklch(0.76 0.15 120)',
  'oklch(0.72 0.15 150)': 'oklch(0.76 0.15 150)',
  'oklch(0.72 0.15 180)': 'oklch(0.76 0.15 180)',
  'oklch(0.72 0.15 210)': 'oklch(0.76 0.15 210)',
  'oklch(0.72 0.15 240)': 'oklch(0.76 0.15 240)',
  'oklch(0.72 0.15 270)': 'oklch(0.76 0.15 270)',
  'oklch(0.72 0.15 300)': 'oklch(0.76 0.15 300)',
  'oklch(0.72 0.15 330)': 'oklch(0.76 0.15 330)',
  // Old 0.65 lightness colors -> new 0.76 colors
  'oklch(0.65 0.15 0)': 'oklch(0.76 0.15 0)',
  'oklch(0.65 0.15 25)': 'oklch(0.76 0.15 30)',
  'oklch(0.65 0.15 30)': 'oklch(0.76 0.15 30)',
  'oklch(0.65 0.15 45)': 'oklch(0.76 0.15 30)',
  'oklch(0.65 0.15 60)': 'oklch(0.76 0.15 60)',
  'oklch(0.65 0.15 65)': 'oklch(0.76 0.15 60)',
  'oklch(0.65 0.15 85)': 'oklch(0.76 0.15 90)',
  'oklch(0.65 0.15 90)': 'oklch(0.76 0.15 90)',
  'oklch(0.65 0.15 105)': 'oklch(0.76 0.15 120)',
  'oklch(0.65 0.15 120)': 'oklch(0.76 0.15 120)',
  'oklch(0.65 0.15 145)': 'oklch(0.76 0.15 150)',
  'oklch(0.65 0.15 150)': 'oklch(0.76 0.15 150)',
  'oklch(0.65 0.15 165)': 'oklch(0.76 0.15 150)',
  'oklch(0.65 0.15 180)': 'oklch(0.76 0.15 180)',
  'oklch(0.65 0.15 185)': 'oklch(0.76 0.15 180)',
  'oklch(0.65 0.15 205)': 'oklch(0.76 0.15 210)',
  'oklch(0.65 0.15 210)': 'oklch(0.76 0.15 210)',
  'oklch(0.65 0.15 240)': 'oklch(0.76 0.15 240)',
  'oklch(0.65 0.15 245)': 'oklch(0.76 0.15 240)',
  'oklch(0.65 0.15 265)': 'oklch(0.76 0.15 270)',
  'oklch(0.65 0.15 270)': 'oklch(0.76 0.15 270)',
  'oklch(0.65 0.15 285)': 'oklch(0.76 0.15 270)',
  'oklch(0.65 0.15 300)': 'oklch(0.76 0.15 300)',
  'oklch(0.65 0.15 305)': 'oklch(0.76 0.15 300)',
  'oklch(0.65 0.15 325)': 'oklch(0.76 0.15 330)',
  'oklch(0.65 0.15 330)': 'oklch(0.76 0.15 330)',
  'oklch(0.65 0.15 15)': 'oklch(0.76 0.15 0)',
  // Old muted colors (0.55 lightness) -> new colors
  'oklch(0.55 0.08 25)': 'oklch(0.76 0.15 0)',
  'oklch(0.55 0.08 85)': 'oklch(0.76 0.15 90)',
  'oklch(0.55 0.08 165)': 'oklch(0.76 0.15 150)',
  'oklch(0.55 0.08 245)': 'oklch(0.76 0.15 240)',
  'oklch(0.55 0.08 325)': 'oklch(0.76 0.15 330)',
};

/**
 * Normalize a project color to the new uniform palette
 * Automatically converts old colors to their nearest new equivalent
 * 
 * @param color - The color to normalize (OKLCH format)
 * @returns The normalized color from the new palette
 */
export function normalizeProjectColor(color: string): string {
  // Check if exact mapping exists
  if (OLD_TO_NEW_MAP[color]) {
    return OLD_TO_NEW_MAP[color];
  }

  // If already a new color, return as-is
  if (isProjectPaletteColor(color)) {
    return color;
  }

  // Extract hue from OKLCH color
  const match = color.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) {
    console.warn(`⚠️  Could not parse color: ${color}, using default`);
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

  return `oklch(0.76 0.15 ${closestHue})`;
}

/**
 * Check if a color needs normalization
 * 
 * @param color - The color to check
 * @returns True if the color is old and needs updating
 */
export function needsColorNormalization(color: string): boolean {
  return !isProjectPaletteColor(color);
}
