// OKLCH color palette - consistent lightness and chroma for harmony
import { ColorCalculationService } from '@/domain/rules/ui/ColorCalculations';

// Brand colors
export const BRAND_COLORS = {
  primary: '#3daae0',
  primaryHover: '#2f8ec4',
  // OKLCH brand color variations (hue 232 to match rgb(61, 170, 224))
  primaryOklch: 'oklch(0.71 0.127 232)',
  primaryOklchLight: 'oklch(0.92 0.05 232)',  // Lighter for backgrounds
  primaryOklchText: 'oklch(0.50 0.127 232)',   // Darker for text
} as const;

// Neutral gray colors - centralized for consistency
// Using true neutral grays (no color temperature)
export const NEUTRAL_COLORS = {
  gray25: '#fcfcfc',      // Even lighter than neutral-50, for very light backgrounds
  gray50: '#fafafa',      // neutral-50
  gray100: '#f5f5f5',     // neutral-100
  gray150: '#ededec',     // Custom gray between 100 and 200
  gray200: '#e5e5e5',     // neutral-200
  gray300: '#d4d4d4',     // neutral-300
  gray400: '#a3a3a3',     // neutral-400
  gray500: '#737373',     // neutral-500
  gray600: '#525252',     // neutral-600
  gray700: '#404040',     // neutral-700
  gray800: '#262626',     // neutral-800
  gray900: '#171717',     // neutral-900
} as const;

// Project colors using OKLCH color space for better accessibility
export const OKLCH_PROJECT_COLORS = [
  'oklch(0.76 0.15 0)',     // Red
  'oklch(0.76 0.15 30)',    // Orange
  'oklch(0.76 0.15 60)',    // Yellow-Orange
  'oklch(0.76 0.15 90)',    // Yellow
  'oklch(0.76 0.15 120)',   // Yellow-Green
  'oklch(0.76 0.15 150)',   // Green
  'oklch(0.76 0.15 180)',   // Cyan
  'oklch(0.76 0.15 210)',   // Sky Blue
  'oklch(0.76 0.15 240)',   // Blue
  'oklch(0.76 0.15 270)',   // Purple
  'oklch(0.76 0.15 300)',   // Magenta
  'oklch(0.76 0.15 330)',   // Pink
] as const;

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

// OKLCH equivalent of the fallback gray - true neutral with no color tint
// Chroma = 0 for completely neutral gray (no hue), lightness matches project colors
export const OKLCH_FALLBACK_GRAY = 'oklch(0.76 0 0)'; // True neutral gray with same lightness as project colors

// OKLCH brown color for habits - lower chroma and warmer hue for earthy brown feel
export const OKLCH_HABIT_BROWN = 'oklch(0.76 0.05 65)'; // Brown hue with reduced chroma for habits