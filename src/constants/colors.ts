// OKLCH color palette - consistent lightness and chroma for harmony
import { OKLCH_PROJECT_COLORS } from './projectModalConstants';
import { ColorCalculationService } from '@/services/core';

export const OKLCH_GROUP_COLORS = [
  'oklch(0.75 0.15 240)',   // Blue (slightly more saturated for groups)
  'oklch(0.75 0.15 120)',   // Green
  'oklch(0.75 0.15 0)',     // Red
  'oklch(0.75 0.15 270)',   // Purple
  'oklch(0.75 0.15 30)',    // Orange
  'oklch(0.75 0.15 180)',   // Cyan
] as const;

// Color utility functions - re-exported from ColorCalculationService for convenience
export const getProjectColor = (index: number): string => {
  return OKLCH_PROJECT_COLORS[index % OKLCH_PROJECT_COLORS.length];
};

export const getGroupColor = (index: number): string => {
  return OKLCH_GROUP_COLORS[index % OKLCH_GROUP_COLORS.length];
};

export const getHoverColor = ColorCalculationService.getHoverColor.bind(ColorCalculationService);
export const getBaselineColor = ColorCalculationService.getBaselineColor.bind(ColorCalculationService);
export const getCompletedPlannedColor = ColorCalculationService.getCompletedPlannedColor.bind(ColorCalculationService);
export const getMidToneColor = ColorCalculationService.getMidToneColor.bind(ColorCalculationService);
export const getAutoEstimateColor = ColorCalculationService.getAutoEstimateColor.bind(ColorCalculationService);
export const getDarkerColor = ColorCalculationService.getDarkerColor.bind(ColorCalculationService);
export const getLighterColor = ColorCalculationService.getLighterColor.bind(ColorCalculationService);

// Calendar-specific color functions
export const getCalendarEventBackgroundColor = (oklchColor: string): string => {
  // Convert to a light version for calendar event backgrounds
  // Target lightness 0.92-0.95 for very light backgrounds that work well with dark text
  return ColorCalculationService.getLighterColor(oklchColor, 0.12); // Increase lightness by 0.12 (from 0.8 to 0.92)
};

export const getCalendarEventTextColor = (oklchColor: string): string => {
  // Convert to a darker version for accessible text
  const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (!match) return oklchColor;

  const [, lightness, chroma, hue] = match;
  // For accessible text on light backgrounds, we need dark text
  // Target lightness 0.25-0.3 provides good contrast against light backgrounds (0.9+)
  const targetLightness = 0.28;

  return `oklch(${targetLightness} ${chroma} ${hue})`;
};

// OKLCH equivalent of the fallback gray (#6b7280) with equivalent lightness to project colors
export const OKLCH_FALLBACK_GRAY = 'oklch(0.8 0.02 280)'; // Low chroma gray with same lightness as project colors