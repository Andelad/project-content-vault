/**
 * Visual Styling Constants
 * Single source of truth for all visual styling rules across the application
 * 
 * This file centralizes:
 * - Timeline allocation styles (completed, planned, auto-estimate)
 * - Calendar event styles (selected, future, completed, etc.)
 * - Shared visual properties (borders, opacity, etc.)
 */

import type { CSSProperties } from 'react';

// ============================================================================
// TIMELINE ALLOCATION STYLES
// ============================================================================

export const TIMELINE_ALLOCATION_STYLES = {
  completed: {
    description: 'Tracked/logged time - solid darker color',
    colorKey: 'completedPlanned' as const,
    border: null,
    opacity: 1,
  },
  planned: {
    description: 'Scheduled events - lighter with dashed border',
    colorKey: 'autoEstimate' as const,
    border: {
      width: 2,
      style: 'dashed' as const,
      sides: ['left', 'right', 'top', 'bottom'] as const,
      colorKey: 'baseline' as const,
    },
    opacity: 1,
  },
  'auto-estimate': {
    description: 'Auto-calculated estimates - lightest gray',
    colorKey: 'autoEstimate' as const,
    border: null,
    opacity: 1,
  },
} as const;

export type TimelineAllocationType = keyof typeof TIMELINE_ALLOCATION_STYLES;

// ============================================================================
// CALENDAR EVENT STYLES
// ============================================================================

export const CALENDAR_EVENT_STYLES = {
  default: {
    description: 'Normal event appearance',
    background: {
      lightnessIncrease: 0.12, // From base to 0.92
      chromaMultiplier: 0.8, // Reduce chroma: 0.15 → 0.12
    },
    text: {
      targetLightness: 0.35,
      chromaMultiplier: 1,
    },
    border: null,
    opacity: 1,
  },
  selected: {
    description: 'Selected event - darker background with border',
    background: {
      lightnessReduction: 0.02, // Subtle darkening
      chromaMultiplier: 0.5, // Muted
    },
    border: {
      lightnessReduction: 0.15,
      chromaMultiplier: 1,
    },
    opacity: 1,
  },
  future: {
    description: 'Future event - almost white appearance',
    background: {
      targetLightness: 0.98,
      targetChroma: 0.02,
    },
    opacity: 1,
  },
  completed: {
    description: 'Completed event - faded',
    opacityMultiplier: 0.6,
  },
  inactiveLayer: {
    description: 'Not the active layer - heavily faded',
    opacityMultiplier: 0.3,
  },
} as const;

export type CalendarEventStyleType = keyof typeof CALENDAR_EVENT_STYLES;

// ============================================================================
// VISUAL PROPERTIES (shared across components)
// ============================================================================

export const VISUAL_PROPERTIES = {
  borderRadius: {
    small: '2px',
    medium: '4px',
    large: '8px',
  },
  borderWidth: {
    thin: '1px',
    medium: '2px',
    thick: '4px',
  },
  opacity: {
    full: 1,
    high: 0.8,
    medium: 0.6,
    low: 0.3,
    veryLow: 0.1,
  },
} as const;

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface StyleTransform {
  lightnessIncrease?: number;
  lightnessReduction?: number;
  targetLightness?: number;
  targetChroma?: number;
  chromaMultiplier?: number;
}

export interface BorderStyleConfig {
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  sides?: ('left' | 'right' | 'top' | 'bottom')[];
  colorKey?: string;
  lightnessReduction?: number;
  chromaMultiplier?: number;
}

export interface ProjectColorScheme {
  baseline: string;
  completedPlanned: string;
  main: string;
  midTone: string;
  hover: string;
  autoEstimate: string;
}
