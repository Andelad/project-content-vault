/**
 * Color Calculation Service
 * Centralized service for OKLCH color manipulations and variants
 * Provides consistent color transformations across the application
 */

import { TIMELINE_ALLOCATION_STYLES, CALENDAR_EVENT_STYLES, type TimelineAllocationType, type ProjectColorScheme } from '@/constants/styles';
import type { CSSProperties } from 'react';

export class ColorCalculationService {
  /**
   * Get hover color variant (slightly lighter and more saturated)
   */
  static getHoverColor(oklchColor: string): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;
    
    const [, lightness, chroma, hue] = match;
    const newLightness = Math.min(1, parseFloat(lightness) + 0.06); // +0.06 from baseline
    const newChroma = Math.min(0.3, parseFloat(chroma) + 0.04); // +0.04 from baseline
    
    return `oklch(${newLightness} ${newChroma} ${hue})`;
  }

  /**
   * Get baseline color variant (darker version for lines/borders)
   */
  static getBaselineColor(oklchColor: string): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;
    
    const [, lightness, chroma, hue] = match;
    const newLightness = Math.max(0, parseFloat(lightness) - 0.15); // Darker for borders
    
    return `oklch(${newLightness} ${chroma} ${hue})`;
  }

  /**
   * Get completed planned time color variant (lighter than baseline for better visibility)
   */
  static getCompletedPlannedColor(oklchColor: string): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;
    
    const [, lightness, chroma, hue] = match;
    const newLightness = Math.max(0, parseFloat(lightness) - 0.10); // Darker than main for completed time
    
    return `oklch(${newLightness} ${chroma} ${hue})`;
  }

  /**
   * Get mid-tone color variant (between baseline and main color)
   */
  static getMidToneColor(oklchColor: string): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;
    
    const [, lightness, chroma, hue] = match;
    // Exactly match main color for now (no change)
    return `oklch(${lightness} ${chroma} ${hue})`;
  }

  /**
   * Get auto-estimate color variant (slightly lighter for estimated values)
   */
  static getAutoEstimateColor(oklchColor: string): string {
    const match = oklchColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return oklchColor;
    
    const [, lightness, chroma, hue] = match;
    const newLightness = Math.min(1, parseFloat(lightness) + 0.10); // Moderately lighter for auto-estimate
    const newChroma = Math.max(0, parseFloat(chroma) * 0.6); // Reduce saturation for softer appearance
    
    return `oklch(${newLightness} ${newChroma} ${hue})`;
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

  /**
   * Get timeline allocation style based on centralized style constants
   * Returns complete CSS properties for the allocation type
   */
  static getTimelineAllocationStyle(
    allocationType: TimelineAllocationType,
    colorScheme: ProjectColorScheme
  ): CSSProperties {
    const styleConfig = TIMELINE_ALLOCATION_STYLES[allocationType];
    
    const style: CSSProperties = {
      backgroundColor: colorScheme[styleConfig.colorKey],
      opacity: styleConfig.opacity,
    };

    if (styleConfig.border) {
      const borderColor = colorScheme[styleConfig.border.colorKey];
      const borderValue = `${styleConfig.border.width}px ${styleConfig.border.style} ${borderColor}`;
      
      styleConfig.border.sides.forEach(side => {
        const key = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof CSSProperties;
        style[key] = borderValue as any;
      });
    } else {
      // No borders for non-bordered types
      style.borderRight = 'none';
      style.borderLeft = 'none';
      style.borderTop = 'none';
      style.borderBottom = 'none';
    }

    return style;
  }

  /**
   * Apply OKLCH color transformation based on style configuration
   */
  static applyColorTransform(
    baseColor: string,
    transform: {
      lightnessIncrease?: number;
      lightnessReduction?: number;
      targetLightness?: number;
      targetChroma?: number;
      chromaMultiplier?: number;
    }
  ): string {
    const match = baseColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    if (!match) return baseColor;

    const [, lightness, chroma, hue] = match;
    let newLightness = parseFloat(lightness);
    let newChroma = parseFloat(chroma);

    // Apply transformations
    if (transform.targetLightness !== undefined) {
      newLightness = transform.targetLightness;
    } else if (transform.lightnessIncrease !== undefined) {
      newLightness = Math.min(1, newLightness + transform.lightnessIncrease);
    } else if (transform.lightnessReduction !== undefined) {
      newLightness = Math.max(0, newLightness - transform.lightnessReduction);
    }

    if (transform.targetChroma !== undefined) {
      newChroma = transform.targetChroma;
    } else if (transform.chromaMultiplier !== undefined) {
      newChroma = newChroma * transform.chromaMultiplier;
    }

    return `oklch(${newLightness} ${newChroma} ${hue})`;
  }

  /**
   * Calculate event background color using centralized style constants
   */
  static getEventBackgroundColor(
    baseColor: string,
    state: 'default' | 'selected' | 'future' = 'default'
  ): string {
    if (state === 'default') {
      const styleConfig = CALENDAR_EVENT_STYLES.default;
      return this.applyColorTransform(baseColor, styleConfig.background);
    } else if (state === 'selected') {
      // First get the light background, then darken it
      const lightBg = this.applyColorTransform(baseColor, CALENDAR_EVENT_STYLES.default.background);
      return this.applyColorTransform(lightBg, CALENDAR_EVENT_STYLES.selected.background);
    } else if (state === 'future') {
      return this.applyColorTransform(baseColor, CALENDAR_EVENT_STYLES.future.background);
    }
    
    return baseColor;
  }

  /**
   * Calculate event text color using centralized style constants
   */
  static getEventTextColor(baseColor: string): string {
    const textConfig = CALENDAR_EVENT_STYLES.default.text;
    const match = baseColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
    
    if (!match) return baseColor;
    
    const [, lightness, chroma, hue] = match;
    const chromaValue = parseFloat(chroma);
    
    // If base color is gray (chroma ~0), keep text gray too (don't force chroma up)
    const textChroma = chromaValue < 0.02 
      ? 0 // Keep it gray
      : Math.max(0.12, chromaValue * textConfig.chromaMultiplier);
    
    return `oklch(${textConfig.targetLightness} ${textChroma} ${hue})`;
  }

  /**
   * Calculate event border color for selected state
   */
  static getEventBorderColor(baseColor: string): string {
    const selectedStyle = CALENDAR_EVENT_STYLES.selected;
    if (!selectedStyle.border) return 'transparent';
    
    return this.applyColorTransform(baseColor, {
      lightnessReduction: selectedStyle.border.lightnessReduction,
      chromaMultiplier: selectedStyle.border.chromaMultiplier,
    });
  }

  /**
   * Calculate final opacity based on event states
   */
  static getEventOpacity(
    isCompleted: boolean = false,
    isActiveLayer: boolean = true
  ): number {
    const baseOpacity = isCompleted 
      ? (CALENDAR_EVENT_STYLES.completed.opacityMultiplier ?? 1)
      : CALENDAR_EVENT_STYLES.default.opacity;
    
    return isActiveLayer 
      ? baseOpacity 
      : baseOpacity * (CALENDAR_EVENT_STYLES.inactiveLayer.opacityMultiplier ?? 1);
  }
}
