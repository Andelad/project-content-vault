/**
 * Timeline Availability Circle Sizing Service
 * Handles all calculations related to availability circle sizing in different timeline views
 */

export interface AvailabilityCircleSizing {
  outerDiameter: number;
  innerDiameter: number;
  pixelsPerHour: number;
}

/**
 * Calculate availability circle sizing based on hours and timeline view mode
 * 
 * In day view, 8 hours = full size circle
 * In week view, 40 hours (5x8) = same full size circle
 * This ensures circles require 5x more hours to reach the same visual size in weeks view
 * 
 * @param targetHours - Total hours to represent visually
 * @param mode - Timeline view mode ('days' or 'weeks')
 * @returns Circle sizing information with outer and inner diameters
 */
export function calculateAvailabilityCircleSize(
  targetHours: number,
  mode: 'days' | 'weeks'
): AvailabilityCircleSizing {
  // Scale hours based on view mode
  // In weeks view, divide hours by 5 so it takes 5x more hours to reach same visual size
  const scaledHours = mode === 'weeks' ? targetHours / 5 : targetHours;
  
  // Split scaled hours: first 8 hours (main circle), then up to 7 more hours (inner circle)
  const mainHours = Math.min(scaledHours, 8);
  const extraHours = Math.max(0, Math.min(scaledHours - 8, 7));
  
  // Convert to pixels (consistent 3px = 1 scaled hour for both views)
  const pixelsPerHour = 3;
  const outerDiameter = mainHours * pixelsPerHour;
  const innerDiameter = extraHours * pixelsPerHour;
  
  return {
    outerDiameter,
    innerDiameter,
    pixelsPerHour
  };
}

/**
 * Get minimum circle dimensions to ensure visibility
 * Ensures circles have minimum visual presence even for small hour values
 * 
 * @param diameter - Calculated diameter in pixels
 * @returns Minimum diameter to use for rendering
 */
export function getMinimumCircleDimensions(diameter: number): number {
  return diameter > 0 ? Math.max(diameter, 6) : 0;
}
