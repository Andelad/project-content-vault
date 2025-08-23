// OKLCH color palette - consistent lightness and chroma for harmony
export const OKLCH_PROJECT_COLORS = [
  'oklch(0.8 0.12 0)',      // Red
  'oklch(0.8 0.12 30)',     // Orange
  'oklch(0.8 0.12 60)',     // Yellow-Orange
  'oklch(0.8 0.12 90)',     // Yellow
  'oklch(0.8 0.12 120)',    // Yellow-Green
  'oklch(0.8 0.12 150)',    // Green
  'oklch(0.8 0.12 180)',    // Cyan-Green
  'oklch(0.8 0.12 210)',    // Cyan
  'oklch(0.8 0.12 240)',    // Blue
  'oklch(0.8 0.12 270)',    // Purple
  'oklch(0.8 0.12 300)',    // Magenta
  'oklch(0.8 0.12 330)',    // Pink
] as const;

export const OKLCH_GROUP_COLORS = [
  'oklch(0.75 0.15 240)',   // Blue (slightly more saturated for groups)
  'oklch(0.75 0.15 120)',   // Green
  'oklch(0.75 0.15 0)',     // Red
  'oklch(0.75 0.15 270)',   // Purple
  'oklch(0.75 0.15 30)',    // Orange
  'oklch(0.75 0.15 180)',   // Cyan
] as const;

// Color utility functions
export function getProjectColor(index: number): string {
  return OKLCH_PROJECT_COLORS[index % OKLCH_PROJECT_COLORS.length];
}

export function getGroupColor(index: number): string {
  return OKLCH_GROUP_COLORS[index % OKLCH_GROUP_COLORS.length];
}

export function getHoverColor(oklchColor: string): string {
  return oklchColor.replace('0.8 0.12', '0.86 0.16');
}

export function getBaselineColor(oklchColor: string): string {
  return oklchColor.replace('0.8 0.12', '0.5 0.12');
}

export function getMidToneColor(oklchColor: string): string {
  return oklchColor.replace('0.8 0.12', '0.65 0.12');
}

export function getDarkerColor(oklchColor: string, lightnessReduction: number = 0.2): string {
  const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) return oklchColor;
  
  const [, lightness, chroma, hue] = match;
  const newLightness = Math.max(0, parseFloat(lightness) - lightnessReduction);
  
  return `oklch(${newLightness} ${chroma} ${hue})`;
}

export function getLighterColor(oklchColor: string, lightnessIncrease: number = 0.1): string {
  const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) return oklchColor;
  
  const [, lightness, chroma, hue] = match;
  const newLightness = Math.min(1, parseFloat(lightness) + lightnessIncrease);
  
  return `oklch(${newLightness} ${chroma} ${hue})`;
}

// Calendar-specific color functions
export function getCalendarEventBackgroundColor(oklchColor: string): string {
  // Convert to a light version for calendar event backgrounds
  // Target lightness 0.92-0.95 for very light backgrounds that work well with dark text
  return getLighterColor(oklchColor, 0.12); // Increase lightness by 0.12 (from 0.8 to 0.92)
}

export function getCalendarEventTextColor(oklchColor: string): string {
  // Convert to a darker version for accessible text
  const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) return oklchColor;
  
  const [, lightness, chroma, hue] = match;
  // For accessible text on light backgrounds, we need dark text
  // Target lightness 0.25-0.3 provides good contrast against light backgrounds (0.9+)
  const targetLightness = 0.28;
  
  return `oklch(${targetLightness} ${chroma} ${hue})`;
}

// OKLCH equivalent of the fallback gray (#6b7280) with equivalent lightness to project colors
export const OKLCH_FALLBACK_GRAY = 'oklch(0.8 0.02 280)'; // Low chroma gray with same lightness as project colors