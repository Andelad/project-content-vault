/**
 * Color Calculation Service
 * Centralized service for OKLCH color manipulations and variants
 * Provides consistent color transformations across the application
 */

export class ColorCalculationService {
  /**
   * Get hover color variant (slightly lighter and more saturated)
   */
  static getHoverColor(oklchColor: string): string {
    return oklchColor.replace('0.8 0.12', '0.86 0.16');
  }

  /**
   * Get baseline color variant (darker version for lines/borders)
   */
  static getBaselineColor(oklchColor: string): string {
    return oklchColor.replace('0.8 0.12', '0.5 0.12');
  }

  /**
   * Get completed planned time color variant (lighter than baseline for better visibility)
   */
  static getCompletedPlannedColor(oklchColor: string): string {
    return oklchColor.replace('0.8 0.12', '0.6 0.12');
  }

  /**
   * Get mid-tone color variant (between baseline and main color)
   */
  static getMidToneColor(oklchColor: string): string {
    return oklchColor.replace('0.8 0.12', '0.65 0.12');
  }

  /**
   * Get auto-estimate color variant (slightly lighter for estimated values)
   */
  static getAutoEstimateColor(oklchColor: string): string {
    return oklchColor.replace('0.8 0.12', '0.85 0.12');
  }

  /**
   * Get darker color variant with configurable lightness reduction
   */
  static getDarkerColor(oklchColor: string, lightnessReduction: number = 0.2): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;

    const [, lightness, chroma, hue] = match;
    const newLightness = Math.max(0, parseFloat(lightness) - lightnessReduction);

    return `oklch(${newLightness} ${chroma} ${hue})`;
  }

  /**
   * Get lighter color variant with configurable lightness increase
   */
  static getLighterColor(oklchColor: string, lightnessIncrease: number = 0.1): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;

    const [, lightness, chroma, hue] = match;
    const newLightness = Math.min(1, parseFloat(lightness) + lightnessIncrease);

    return `oklch(${newLightness} ${chroma} ${hue})`;
  }
}
